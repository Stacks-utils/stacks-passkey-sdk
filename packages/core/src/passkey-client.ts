import { Cl, getAddressFromPrivateKey, ClarityVersion, type ClarityValue } from '@stacks/transactions';
import { RelayClient } from './relay-client.js';
import {
  buildExecuteFunctionArgs,
  fetchActionHash,
  getExecuteFunctionName,
  isPublicKeyAuthorized,
  withAccountPayFee,
  withAccountPayInvokeFee,
} from './actions.js';
import { bufferToHex, hexToBuffer, base64UrlDecode } from './crypto.js';
import { normalizeTxId } from './broadcast.js';
import {
  loadOriginPrivateKey,
  originKeyScope,
  saveOriginPrivateKey,
} from './origin-key.js';
import {
  broadcastContractCall,
  resolveAccountPayFeeMicroStx,
  type FeeOptions,
} from './fee.js';
import { broadcastContractDeploy, isContractDeployed } from './deploy.js';
import {
  DEFAULT_SMART_ACCOUNT_NAME,
  deriveOriginPrivateKey,
  originKeyScopeForAddress,
  smartAccountContractId,
} from './derive-origin.js';
import { saveSession, loadSession, clearSession } from './session.js';
import {
  describeCredentialLookupFailure,
  findStoredCredentialById,
  findStoredCredentialByIdGlobal,
  findStoredCredentialByIdRelaxed,
  findStoredCredentials,
  findStoredCredentialsByRpId,
  normalizeRpId,
  saveStoredCredential,
} from './credentials.js';
import { registerPasskey, authenticatePasskey, signWithPasskey } from './webauthn.js';
import { createTestPasskey, signWebAuthnAssertion } from './webauthn-crypto.js';
import type {
  FeeConfig,
  PasskeyAction,
  PasskeyConfig,
  PasskeyCredential,
  PasskeySession,
  ContractCallArgs,
} from './types.js';
import { createInvokeAction } from './actions.js';
import { resolveDeployerAddress } from './types.js';

export interface PasskeyClientOptions extends PasskeyConfig {
  relayApiKey?: string;
  fee?: FeeConfig;
  /** @deprecated Use fee.mode = 'gasless' with fee.relayUrl */
  originPrivateKey?: string;
}

export class PasskeyClient {
  readonly config: PasskeyConfig;
  private readonly relay: RelayClient;
  private fee: FeeConfig;
  private readonly deployerAddress: string;
  private feeRecipient?: string;
  private relaySponsorFeeMicroStx?: bigint;

  constructor(options: PasskeyClientOptions) {
    this.config = {
      ...options,
      rpId: normalizeRpId(options.rpId),
    };
    this.deployerAddress = resolveDeployerAddress(options);
    if (!this.deployerAddress) {
      throw new Error('PasskeyConfig requires deployerAddress');
    }
    this.fee = options.fee ?? {
      mode: 'gasless',
      relayUrl: options.relayUrl,
      relayApiKey: options.relayApiKey,
    };
    this.relay = new RelayClient({
      relayUrl: this.fee.relayUrl ?? options.relayUrl,
      apiKey: this.fee.relayApiKey ?? options.relayApiKey,
    });
  }

  setFeeConfig(fee: FeeConfig): void {
    this.fee = fee;
    if (fee.mode !== 'account-pay') {
      this.feeRecipient = undefined;
      this.relaySponsorFeeMicroStx = undefined;
    } else if (fee.feeRecipient) {
      this.feeRecipient = fee.feeRecipient;
    } else {
      this.feeRecipient = undefined;
    }
  }

  getFeeMode(): FeeConfig['mode'] {
    return this.fee.mode;
  }

  getDeployerAddress(): string {
    return this.deployerAddress;
  }

  /** User smart account contract id, e.g. STxxx.smart-account */
  getAccountContractId(): string | null {
    const account = this.tryGetUserContract();
    return account ? `${account.address}.${account.name}` : null;
  }

  getOriginAddress(): string {
    const session = loadSession();
    if (session?.originAddress) return session.originAddress;
    try {
      return getAddressFromPrivateKey(this.getOriginPrivateKey(), this.getNetworkName());
    } catch {
      return '';
    }
  }

  getSmartAccountName(): string {
    return this.config.smartAccountName ?? DEFAULT_SMART_ACCOUNT_NAME;
  }

  private getNetworkName(): 'mainnet' | 'testnet' {
    return this.config.network.chainId === 1 ? 'mainnet' : 'testnet';
  }

  getRelayClient(): RelayClient {
    return this.relay;
  }

  private credentialFilter() {
    return { deployerAddress: this.deployerAddress, rpId: this.config.rpId };
  }

  private tryGetUserContract(): { address: string; name: string } | null {
    const session = loadSession();
    if (session?.contractAddress && session?.contractName) {
      return { address: session.contractAddress, name: session.contractName };
    }
    return null;
  }

  private getUserContract(): { address: string; name: string } {
    const account = this.tryGetUserContract();
    if (!account) {
      throw new Error('No passkey smart account — register or sign in first');
    }
    return account;
  }

  private getOriginPrivateKey(publicKeyHex?: string): string {
    const session = loadSession();
    const network = String(this.config.network.chainId);
    if (session?.originAddress) {
      const scope = originKeyScopeForAddress(session.originAddress, network);
      const existing = loadOriginPrivateKey(scope);
      if (existing) return existing;
    }

    if (publicKeyHex) {
      const derived = deriveOriginPrivateKey(publicKeyHex, this.config.rpId, this.config.network.chainId);
      const originAddress = getAddressFromPrivateKey(derived, this.getNetworkName());
      saveOriginPrivateKey(originKeyScopeForAddress(originAddress, network), derived);
      return derived;
    }

    const account = this.tryGetUserContract();
    const scope = account
      ? originKeyScope(account.address, account.name, network)
      : `pending:${this.deployerAddress}:${network}`;
    const existing = loadOriginPrivateKey(scope);
    if (existing) return existing;
    throw new Error('Origin key unavailable — register or sign in first');
  }

  private buildSession(
    credentialId: string,
    publicKeyHex: string,
    contractAddress: string,
    contractName: string,
    originAddress?: string
  ): PasskeySession {
    return {
      credentialId,
      publicKeyHex,
      contractAddress,
      contractName,
      contractId: `${contractAddress}.${contractName}`,
      deployerAddress: this.deployerAddress,
      rpId: this.config.rpId,
      feeMode: this.fee.mode,
      originAddress,
    };
  }

  async init(): Promise<void> {
    if (this.fee.feeRecipient) {
      this.feeRecipient = this.fee.feeRecipient;
    }

    const project = await this.relay.getProjectBalance();
    if (!this.feeRecipient && project?.gasTankAddress) {
      this.feeRecipient = project.gasTankAddress;
    }
    if (project?.sponsorFeeMicroStx) {
      this.relaySponsorFeeMicroStx = BigInt(project.sponsorFeeMicroStx);
    }

    if (this.fee.mode === 'account-pay' && !this.feeRecipient) {
      const health = await this.relay.healthCheck();
      const fromHealth = health.sponsorAddress ?? health.registrarAddress;
      if (fromHealth) {
        this.feeRecipient = fromHealth;
      }
      if (!this.relaySponsorFeeMicroStx && health.sponsorFeeMicroStx) {
        this.relaySponsorFeeMicroStx = BigInt(health.sponsorFeeMicroStx);
      }
    }
  }

  private getAccountPayFeeAmount(): bigint {
    return resolveAccountPayFeeMicroStx({
      maxFeeMicroStx: this.fee.maxFeeMicroStx,
      relaySponsorFeeMicroStx: this.relaySponsorFeeMicroStx,
    });
  }

  async register(userId: string, userName: string): Promise<PasskeyCredential> {
    await this.init();
    const registration = await registerPasskey(this.config, userId, userName);
    const publicKeyHex = bufferToHex(registration.publicKey);

    const result = await this.registerPasskeySmartAccount(registration.publicKey, publicKeyHex);
    const { contractAddress, contractName, originAddress, txid } = result;

    const session = this.buildSession(
      registration.credentialId,
      publicKeyHex,
      contractAddress,
      contractName,
      originAddress
    );
    saveSession(session);
    this.persistCredential(session);

    return {
      credentialId: registration.credentialId,
      publicKey: registration.publicKey,
      contractAddress,
      contractName,
      contractId: `${contractAddress}.${contractName}`,
      txid,
    };
  }

  private async registerPasskeySmartAccount(
    publicKey: Uint8Array,
    publicKeyHex: string
  ): Promise<{ contractAddress: string; contractName: string; originAddress: string; txid: string }> {
    const originKey = this.getOriginPrivateKey(publicKeyHex);
    const originAddress = getAddressFromPrivateKey(originKey, this.getNetworkName());
    const contractName = this.getSmartAccountName();
    const contractAddress = originAddress;

    let deployTxid: string | undefined;
    const deployed = await isContractDeployed(this.config.network, contractAddress, contractName);
    if (!deployed) {
      const template = await this.relay.fetchAccountTemplate();
      deployTxid = await broadcastContractDeploy(
        {
          contractName,
          codeBody: template.source,
          originPrivateKey: originKey,
          network: this.config.network,
          clarityVersion: ClarityVersion.Clarity5,
        },
        this.relay
      );
      await this.waitForTx(deployTxid);
    }

    const senderAddress = smartAccountContractId(contractAddress, contractName);
    const alreadyRegistered = await isPublicKeyAuthorized(
      this.config.network,
      contractAddress,
      contractName,
      publicKey,
      senderAddress
    );

    let registerTxid = 'already-registered';
    if (!alreadyRegistered) {
      registerTxid = await this.submitRegistrationForOrigin(publicKey, contractAddress, contractName, publicKeyHex);
      await this.waitForTx(registerTxid);
    }

    await this.relay.ensureAccount(publicKeyHex, {
      originAddress,
      contractName,
    });

    return {
      contractAddress,
      contractName,
      originAddress,
      txid: registerTxid !== 'already-registered' ? registerTxid : deployTxid ?? 'pending',
    };
  }

  private async submitRegistrationForOrigin(
    publicKey: Uint8Array,
    contractAddress: string,
    contractName: string,
    publicKeyHex: string
  ): Promise<string> {
    return this.broadcastCall(
      'register',
      [Cl.buffer(publicKey)],
      { address: contractAddress, name: contractName },
      publicKeyHex
    );
  }

  async registerWithTestPasskey(options: {
    contractAddress: string;
    contractName: string;
  }): Promise<PasskeyCredential & { testPasskey: ReturnType<typeof createTestPasskey> }> {
    await this.init();
    const testPasskey = createTestPasskey();
    const publicKeyHex = bufferToHex(testPasskey.publicKey);

    const { contractAddress, contractName } = options;
    const txid = await this.submitRegistration(testPasskey.publicKey, contractAddress, contractName);
    await this.waitForTx(txid);

    const session = this.buildSession(testPasskey.credentialId, publicKeyHex, contractAddress, contractName);
    saveSession(session);
    this.persistCredential(session);

    return {
      credentialId: testPasskey.credentialId,
      publicKey: testPasskey.publicKey,
      contractAddress,
      contractName,
      contractId: `${contractAddress}.${contractName}`,
      txid,
      testPasskey,
    };
  }

  /** Simnet/tests: bind session to a pre-deployed per-user account contract. */
  bindTestAccount(
    testPasskey: ReturnType<typeof createTestPasskey>,
    contractAddress: string,
    contractName: string
  ): PasskeySession {
    const session = this.buildSession(
      testPasskey.credentialId,
      bufferToHex(testPasskey.publicKey),
      contractAddress,
      contractName
    );
    saveSession(session);
    this.persistCredential(session);
    return session;
  }

  async signIn(): Promise<PasskeySession> {
    await this.init();

    const filter = this.credentialFilter();
    let stored = findStoredCredentials(filter);
    if (stored.length === 0) {
      stored = findStoredCredentialsByRpId(filter.rpId);
    }
    if (stored.length === 0) {
      const hint = describeCredentialLookupFailure(filter);
      throw new Error(`No passkeys found for this app. Sign up first on this device.${hint}`);
    }

    const allowCredentials: PublicKeyCredentialDescriptor[] = stored.map((item) => ({
      id: base64UrlDecode(item.credentialId) as BufferSource,
      type: 'public-key',
    }));

    const authRpId = stored[0]?.rpId ?? this.config.rpId;
    const authConfig = authRpId === this.config.rpId ? this.config : { ...this.config, rpId: authRpId };

    const { credentialId } = await authenticatePasskey(authConfig, allowCredentials);
    const match =
      findStoredCredentialById(credentialId, filter) ??
      findStoredCredentialByIdRelaxed(credentialId, filter.rpId) ??
      findStoredCredentialByIdGlobal(credentialId);
    if (!match) {
      throw new Error('Passkey not recognized for this app');
    }

    const publicKey = hexToBuffer(match.publicKeyHex);

    const originKey = deriveOriginPrivateKey(
      match.publicKeyHex,
      this.config.rpId,
      this.config.network.chainId
    );
    const originAddress = getAddressFromPrivateKey(originKey, this.getNetworkName());
    const contractAddress = originAddress;
    const contractName = this.getSmartAccountName();
    saveOriginPrivateKey(
      originKeyScopeForAddress(originAddress, String(this.config.network.chainId)),
      originKey
    );

    const senderAddress = smartAccountContractId(contractAddress, contractName);
    const authorized = await isPublicKeyAuthorized(
      this.config.network,
      contractAddress,
      contractName,
      publicKey,
      senderAddress
    );

    if (!authorized) {
      throw new Error('Passkey is not registered on chain for this smart account');
    }

    const session = this.buildSession(
      match.credentialId,
      match.publicKeyHex,
      contractAddress,
      contractName,
      originAddress
    );
    saveSession(session);
    this.persistCredential(session);
    return session;
  }

  async submitRegistration(
    publicKey: Uint8Array,
    contractAddress?: string,
    contractName?: string
  ): Promise<string> {
    const account = contractAddress && contractName
      ? { address: contractAddress, name: contractName }
      : this.getUserContract();
    return this.broadcastCall('register', [Cl.buffer(publicKey)], account);
  }

  async invoke(
    contract: string,
    fn: string,
    args?: ContractCallArgs,
    publicKey?: Uint8Array,
    credentialId?: string,
    signCount = 1
  ): Promise<string> {
    await this.relay.ensureContract(contract);
    const action = createInvokeAction(contract, fn, args);
    const session = this.getSession();
    const pk = publicKey ?? (session ? hexToBuffer(session.publicKeyHex) : null);
    const cred = credentialId ?? session?.credentialId;
    if (!pk || !cred) {
      throw new Error('invoke requires an active session or explicit publicKey/credentialId');
    }
    return this.executeAction(action, pk, cred, signCount);
  }

  /** Passkey-signed STX transfer from the user's smart account. */
  async transfer(recipient: string, amount: bigint): Promise<string> {
    const session = this.getSession();
    if (!session?.publicKeyHex || !session.credentialId) {
      throw new Error('transfer requires an active passkey session');
    }
    return this.executeAction(
      { type: 'transfer', recipient, amount },
      hexToBuffer(session.publicKeyHex),
      session.credentialId
    );
  }

  async executeAction(
    action: PasskeyAction,
    publicKey: Uint8Array,
    credentialId: string,
    signCount = 1
  ): Promise<string> {
    await this.init();
    const resolvedAction = await this.resolveActionForFeeMode(action);
    const account = this.getUserContract();
    const senderAddress = `${account.address}.${account.name}`;
    const actionHash = await fetchActionHash(
      this.config.network,
      account.address,
      account.name,
      resolvedAction,
      senderAddress
    );

    if (typeof navigator === 'undefined' || !navigator.credentials) {
      throw new Error('Browser WebAuthn required for executeAction; use executeActionWithTestPasskey in tests');
    }

    const assertion = await signWithPasskey(this.config, credentialId, actionHash);
    return this.submitSignedAction(resolvedAction, publicKey, assertion);
  }

  async executeActionWithTestPasskey(
    action: PasskeyAction,
    testPasskey: ReturnType<typeof createTestPasskey>,
    signCount = 1
  ): Promise<string> {
    await this.init();
    const resolvedAction = await this.resolveActionForFeeMode(action);
    const account = this.getUserContract();
    const senderAddress = `${account.address}.${account.name}`;
    const actionHash = await fetchActionHash(
      this.config.network,
      account.address,
      account.name,
      resolvedAction,
      senderAddress
    );

    const assertion = signWebAuthnAssertion(
      testPasskey,
      actionHash,
      this.config.rpId,
      this.config.origin,
      signCount
    );

    return this.submitSignedAction(resolvedAction, testPasskey.publicKey, assertion);
  }

  async submitSignedAction(
    action: PasskeyAction,
    publicKey: Uint8Array,
    assertion: { signature: Uint8Array; authenticatorData: Uint8Array; clientDataJSON: Uint8Array }
  ): Promise<string> {
    return this.broadcastCall(
      getExecuteFunctionName(action),
      buildExecuteFunctionArgs(
        action,
        publicKey,
        assertion.signature,
        assertion.authenticatorData,
        assertion.clientDataJSON
      ),
      this.getUserContract(),
      undefined,
      this.readAccountPayFeeAmount(action)
    );
  }

  private async resolveActionForFeeMode(action: PasskeyAction): Promise<PasskeyAction> {
    if (this.fee.mode !== 'account-pay') {
      return action;
    }

    const feeRecipient = this.feeRecipient ?? this.fee.feeRecipient;
    if (!feeRecipient) {
      throw new Error(
        'account-pay mode requires feeRecipient (set fee.feeRecipient, or use relayApiKey so /v1/project can resolve gasTankAddress)'
      );
    }

    const feeAmount = this.getAccountPayFeeAmount();

    if (action.type === 'transfer') {
      return withAccountPayFee(action, feeRecipient, feeAmount);
    }
    if (action.type === 'invoke') {
      return withAccountPayInvokeFee(action, feeRecipient, feeAmount);
    }
    return action;
  }

  private buildFeeOptions(accountPayFeeAmount?: bigint): FeeOptions {
    if (this.fee.mode === 'account-pay') {
      const feeRecipient = this.feeRecipient ?? this.fee.feeRecipient;
      if (!feeRecipient) {
        throw new Error('account-pay mode requires feeRecipient');
      }
      if (accountPayFeeAmount === undefined) {
        throw new Error('account-pay mode requires a resolved fee amount');
      }
      return {
        mode: 'account-pay',
        maxFeeMicroStx: this.getAccountPayFeeAmount(),
        accountPay: {
          relay: this.relay,
          feeRecipient,
          feeAmountMicroStx: accountPayFeeAmount,
        },
      };
    }

    return {
      mode: 'gasless',
      gasless: { relay: this.relay },
    };
  }

  private readAccountPayFeeAmount(action: PasskeyAction): bigint | undefined {
    if (action.type === 'transfer' || action.type === 'invoke') {
      return action.feeAmount;
    }
    return undefined;
  }

  private async broadcastCall(
    functionName: string,
    functionArgs: ClarityValue[],
    account = this.getUserContract(),
    publicKeyHex?: string,
    accountPayFeeAmount?: bigint
  ): Promise<string> {
    const registrationUsesGasless =
      functionName === 'register' && this.fee.mode === 'account-pay';

    const feeOptions = registrationUsesGasless
      ? { mode: 'gasless' as const, gasless: { relay: this.relay } }
      : this.buildFeeOptions(accountPayFeeAmount);

    return broadcastContractCall(
      {
        contractAddress: account.address,
        contractName: account.name,
        functionName,
        functionArgs,
        originPrivateKey: this.getOriginPrivateKey(publicKeyHex ?? loadSession()?.publicKeyHex),
        network: this.config.network,
      },
      feeOptions
    );
  }

  private async waitForTx(txid: string, maxAttempts = 40): Promise<void> {
    if (txid === 'already-registered' || txid === 'pending') return;
    const normalizedTxid = normalizeTxId(txid);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const url = `${this.config.network.client.baseUrl}/extended/v1/tx/${normalizedTxid}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as { tx_status: string; tx_result?: { repr?: string }; vm_error?: string | null };
      if (data.tx_status === 'success') return;
      if (data.tx_status === 'abort_by_response' || data.tx_status === 'failed') {
        const detail = data.vm_error ?? data.tx_result?.repr ?? data.tx_status;
        throw new Error(`Transaction failed on chain: ${detail}`);
      }
    }
    throw new Error(`Transaction ${normalizedTxid} was not confirmed on chain`);
  }

  getSession(): PasskeySession | null {
    return loadSession();
  }

  logout(): void {
    clearSession();
  }

  private persistCredential(session: PasskeySession): void {
    saveStoredCredential({
      credentialId: session.credentialId,
      publicKeyHex: session.publicKeyHex,
      contractAddress: session.contractAddress,
      contractName: session.contractName,
      contractId: session.contractId,
      deployerAddress: session.deployerAddress,
      rpId: session.rpId,
    });
  }
}
