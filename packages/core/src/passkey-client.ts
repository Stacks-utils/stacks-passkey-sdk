import { Cl, getAddressFromPrivateKey, randomPrivateKey, type ClarityValue } from '@stacks/transactions';
import { RelayClient } from './relay-client.js';
import {
  buildExecuteFunctionArgs,
  fetchActionHash,
  getExecuteFunctionName,
  isPublicKeyAuthorized,
  withAccountPayFee,
} from './actions.js';
import { bufferToHex, hexToBuffer, base64UrlDecode } from './crypto.js';
import { normalizeTxId } from './broadcast.js';
import { loadOriginPrivateKey, originKeyScope, saveOriginPrivateKey } from './origin-key.js';
import {
  broadcastContractCall,
  type FeeOptions,
} from './fee.js';
import { saveSession, loadSession, clearSession } from './session.js';
import {
  findStoredCredentialById,
  findStoredCredentials,
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
  TransferAction,
} from './types.js';

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
  private readonly originScope: string;
  private originPrivateKey: string;
  private feeRecipient?: string;

  constructor(options: PasskeyClientOptions) {
    this.config = options;
    this.fee = options.fee ?? {
      mode: 'gasless',
      relayUrl: options.relayUrl,
      relayApiKey: options.relayApiKey,
    };
    this.relay = new RelayClient({
      relayUrl: this.fee.relayUrl ?? options.relayUrl,
      apiKey: this.fee.relayApiKey ?? options.relayApiKey,
    });
    this.originScope = originKeyScope(
      options.contractAddress,
      options.contractName,
      String(options.network.chainId)
    );
    this.originPrivateKey =
      options.originPrivateKey ?? loadOriginPrivateKey(this.originScope) ?? randomPrivateKey();
    saveOriginPrivateKey(this.originScope, this.originPrivateKey);
  }

  setFeeConfig(fee: FeeConfig): void {
    this.fee = fee;
  }

  getFeeMode(): FeeConfig['mode'] {
    return this.fee.mode;
  }

  getOriginAddress(): string {
    return getAddressFromPrivateKey(this.originPrivateKey, this.getNetworkName());
  }

  private getNetworkName(): 'mainnet' | 'testnet' {
    return this.config.network.chainId === 1 ? 'mainnet' : 'testnet';
  }

  getRelayClient(): RelayClient {
    return this.relay;
  }

  async init(): Promise<void> {
    if (this.fee.mode === 'account-pay' && !this.fee.feeRecipient) {
      const health = await this.relay.healthCheck();
      if (health.sponsorAddress) {
        this.feeRecipient = health.sponsorAddress;
      }
    }
    if (this.fee.feeRecipient) {
      this.feeRecipient = this.fee.feeRecipient;
    }
  }

  async register(userId: string, userName: string): Promise<PasskeyCredential> {
    await this.init();
    const registration = await registerPasskey(this.config, userId, userName);

    const session: PasskeySession = {
      credentialId: registration.credentialId,
      publicKeyHex: bufferToHex(registration.publicKey),
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      rpId: this.config.rpId,
      feeMode: this.fee.mode,
    };

    saveSession(session);
    this.persistCredential(session);

    const senderAddress = `${this.config.contractAddress}.${this.config.contractName}`;
    const alreadyRegistered = await isPublicKeyAuthorized(
      this.config.network,
      this.config.contractAddress,
      this.config.contractName,
      registration.publicKey,
      senderAddress
    );

    let txid: string;
    if (alreadyRegistered) {
      txid = 'already-registered';
    } else {
      txid = await this.submitRegistration(registration.publicKey);
      await this.waitForTx(txid);
    }

    return {
      credentialId: registration.credentialId,
      publicKey: registration.publicKey,
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      txid,
    };
  }

  async registerWithTestPasskey(): Promise<PasskeyCredential & { testPasskey: ReturnType<typeof createTestPasskey> }> {
    await this.init();
    const testPasskey = createTestPasskey();
    const txid = await this.submitRegistration(testPasskey.publicKey);
    await this.waitForTx(txid);

    const session: PasskeySession = {
      credentialId: testPasskey.credentialId,
      publicKeyHex: bufferToHex(testPasskey.publicKey),
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      rpId: this.config.rpId,
      feeMode: this.fee.mode,
    };
    saveSession(session);
    this.persistCredential(session);

    return {
      credentialId: testPasskey.credentialId,
      publicKey: testPasskey.publicKey,
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      txid,
      testPasskey,
    };
  }

  async signIn(): Promise<PasskeySession> {
    await this.init();

    const stored = findStoredCredentials({
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      rpId: this.config.rpId,
    });

    if (stored.length === 0) {
      throw new Error('No passkeys found for this app. Sign up first on this device.');
    }

    const allowCredentials: PublicKeyCredentialDescriptor[] = stored.map((item) => ({
      id: base64UrlDecode(item.credentialId) as BufferSource,
      type: 'public-key',
    }));

    const { credentialId } = await authenticatePasskey(this.config, allowCredentials);
    const match = findStoredCredentialById(credentialId, {
      contractAddress: this.config.contractAddress,
      contractName: this.config.contractName,
      rpId: this.config.rpId,
    });

    if (!match) {
      throw new Error('Passkey not recognized for this app');
    }

    const publicKey = hexToBuffer(match.publicKeyHex);
    const senderAddress = `${this.config.contractAddress}.${this.config.contractName}`;
    const authorized = await isPublicKeyAuthorized(
      this.config.network,
      this.config.contractAddress,
      this.config.contractName,
      publicKey,
      senderAddress
    );

    if (!authorized) {
      throw new Error('Passkey is not registered on chain for this contract');
    }

    const session: PasskeySession = {
      credentialId: match.credentialId,
      publicKeyHex: match.publicKeyHex,
      contractAddress: match.contractAddress,
      contractName: match.contractName,
      rpId: match.rpId,
      feeMode: this.fee.mode,
    };
    saveSession(session);
    return session;
  }

  async submitRegistration(publicKey: Uint8Array): Promise<string> {
    return this.broadcastCall('register', [Cl.buffer(publicKey)]);
  }

  async executeAction(
    action: PasskeyAction,
    publicKey: Uint8Array,
    credentialId: string,
    signCount = 1
  ): Promise<string> {
    await this.init();
    const resolvedAction = await this.resolveActionForFeeMode(action);
    const senderAddress = `${this.config.contractAddress}.${this.config.contractName}`;
    const actionHash = await fetchActionHash(
      this.config.network,
      this.config.contractAddress,
      this.config.contractName,
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
    const senderAddress = `${this.config.contractAddress}.${this.config.contractName}`;
    const actionHash = await fetchActionHash(
      this.config.network,
      this.config.contractAddress,
      this.config.contractName,
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
      )
    );
  }

  private async resolveActionForFeeMode(action: PasskeyAction): Promise<PasskeyAction> {
    if (this.fee.mode !== 'account-pay' || action.type !== 'transfer') {
      return action;
    }
    const feeRecipient = this.feeRecipient ?? this.fee.feeRecipient;
    if (!feeRecipient) {
      throw new Error('account-pay mode requires feeRecipient (from relay /health or fee config)');
    }

    const feeAmount = this.fee.maxFeeMicroStx ?? 100_000n;
    return withAccountPayFee(action, feeRecipient, feeAmount);
  }

  private buildFeeOptions(): FeeOptions {
    if (this.fee.mode === 'account-pay') {
      const feeRecipient = this.feeRecipient ?? this.fee.feeRecipient;
      if (!feeRecipient) {
        throw new Error('account-pay mode requires feeRecipient');
      }
      return {
        mode: 'account-pay',
        maxFeeMicroStx: this.fee.maxFeeMicroStx,
        accountPay: {
          relay: this.relay,
          feeRecipient,
        },
      };
    }

    return {
      mode: 'gasless',
      gasless: { relay: this.relay },
    };
  }

  private async broadcastCall(functionName: string, functionArgs: ClarityValue[]): Promise<string> {
    const registrationUsesGasless =
      functionName === 'register' && this.fee.mode === 'account-pay';

    const feeOptions = registrationUsesGasless
      ? { mode: 'gasless' as const, gasless: { relay: this.relay } }
      : this.buildFeeOptions();

    return broadcastContractCall(
      {
        contractAddress: this.config.contractAddress,
        contractName: this.config.contractName,
        functionName,
        functionArgs,
        originPrivateKey: this.originPrivateKey,
        network: this.config.network,
      },
      feeOptions
    );
  }

  private async waitForTx(txid: string, maxAttempts = 40): Promise<void> {
    const normalizedTxid = normalizeTxId(txid);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const url = `${this.config.network.client.baseUrl}/extended/v1/tx/${normalizedTxid}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as { tx_status: string };
      if (data.tx_status === 'success') return;
      if (data.tx_status === 'abort_by_response' || data.tx_status === 'failed') {
        throw new Error(`Transaction failed on chain: ${data.tx_status}`);
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
      rpId: session.rpId,
    });
  }
}
