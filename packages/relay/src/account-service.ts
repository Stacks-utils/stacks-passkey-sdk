import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Cl,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  makeContractCall,
  cvToValue,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { RelayConfig } from './types.js';
import type { AccountStore } from './accounts.js';
import type { GasTankStore } from './gas-tank.js';
import { waitForTx } from './tx-wait.js';
import {
  broadcastWithNonceRetry,
  runWithDeployerLock,
} from './registrar-queue.js';
import { runWithSponsorLock } from './sponsor-lock.js';
import { fetchStxBalanceMicro } from './on-chain-balance.js';

export interface EnsureAccountResult {
  contractAddress: string;
  contractName: string;
  contractId: string;
  alreadyRegistered: boolean;
  originAddress: string;
  registerTxid?: string;
  factoryTxid?: string;
}

function getNetwork(name: RelayConfig['network']) {
  return name === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function defaultAccountContractPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '../../../contracts/contracts/passkey-account.clar');
}

export const DEFAULT_SELF_DEPLOY_ACCOUNT_NAME =
  process.env.PASSKEY_SMART_ACCOUNT_NAME ?? 'smart-account';

export interface EnsureAccountOptions {
  originAddress?: string;
  contractName?: string;
}

export class AccountService {
  constructor(
    private readonly config: RelayConfig,
    private readonly store: AccountStore,
    private readonly gasTank?: GasTankStore
  ) {}

  async ensureAccount(
    projectId: string,
    publicKeyHex: string,
    options: EnsureAccountOptions = {}
  ): Promise<EnsureAccountResult> {
    return runWithDeployerLock(() => this.ensureAccountInner(projectId, publicKeyHex, options));
  }

  getAccountContractTemplate(): { contractName: string; source: string; clarityVersion: number } {
    return {
      contractName: DEFAULT_SELF_DEPLOY_ACCOUNT_NAME,
      source: this.buildAccountContractSource(),
      clarityVersion: 5,
    };
  }

  /** Inject fully-qualified passkey-adapter references for user-origin deploys. */
  buildAccountContractSource(): string {
    const adapterAddress =
      process.env.PASSKEY_ADAPTER_ADDRESS ?? process.env.PASSKEY_DEPLOYER_ADDRESS ?? '';
    const adapterName = process.env.PASSKEY_ADAPTER_NAME ?? 'passkey-adapter';
    if (!adapterAddress) {
      throw new Error('PASSKEY_ADAPTER_ADDRESS or PASSKEY_DEPLOYER_ADDRESS must be configured');
    }
    const adapterContract = `'${adapterAddress}.${adapterName}`;
    return this.readAccountContractSource()
      .replace(
        '(use-trait exec-trait .passkey-adapter.passkey-exec-trait)',
        `(use-trait exec-trait ${adapterContract}.passkey-exec-trait)`
      )
      .replace(
        '(contract-call? .passkey-adapter forward-invoke',
        `(contract-call? ${adapterContract} forward-invoke`
      );
  }

  private async ensureAccountInner(
    projectId: string,
    publicKeyHex: string,
    options: EnsureAccountOptions
  ): Promise<EnsureAccountResult> {
    const normalized = publicKeyHex.toLowerCase().replace(/^0x/, '');
    if (normalized.length !== 66) {
      throw new Error('publicKeyHex must be 33-byte compressed key (66 hex chars)');
    }

    const originAddress = options.originAddress;
    if (!originAddress) {
      throw new Error('originAddress is required');
    }

    const contractName = options.contractName ?? DEFAULT_SELF_DEPLOY_ACCOUNT_NAME;
    const contractAddress = originAddress;
    const contractId = `${contractAddress}.${contractName}`;

    const cached = this.store.find(projectId, normalized);
    if (cached?.registerTxid && cached.contractName === contractName && cached.contractAddress === contractAddress) {
      return {
        contractAddress,
        contractName,
        contractId,
        originAddress,
        alreadyRegistered: true,
        registerTxid: cached.registerTxid,
        factoryTxid: cached.factoryTxid,
      };
    }

    const deployerAddress = process.env.PASSKEY_DEPLOYER_ADDRESS ?? process.env.PASSKEY_ADAPTER_ADDRESS;
    const factoryAddress = process.env.PASSKEY_FACTORY_ADDRESS ?? deployerAddress;
    const factoryName = process.env.PASSKEY_FACTORY_NAME ?? 'passkey-factory';
    if (!deployerAddress || !factoryAddress) {
      throw new Error('PASSKEY_DEPLOYER_ADDRESS or PASSKEY_FACTORY_ADDRESS must be configured');
    }

    const maxAccounts = Number(process.env.ACCOUNTS_MAX_PER_PROJECT ?? '500');
    if (this.gasTank && this.store.count(projectId) >= maxAccounts && !cached) {
      throw new Error(`Project exceeded max passkey accounts (${maxAccounts})`);
    }

    const network = getNetwork(this.config.network);
    const pubkeyBuffer = Buffer.from(normalized, 'hex');

    const deployed = await this.isContractDeployed(contractAddress, contractName, network);
    if (!deployed) {
      throw new Error(`Smart account ${contractId} is not deployed on chain yet`);
    }

    const registered = await this.isKeyRegistered(
      contractAddress,
      contractName,
      pubkeyBuffer,
      network,
      contractAddress
    );
    if (!registered) {
      throw new Error(`Passkey is not registered on ${contractId}`);
    }

    const onChain = await this.lookupFactoryAccount(factoryAddress, factoryName, pubkeyBuffer, deployerAddress);
    let factoryTxid = cached?.factoryTxid;
    if (!onChain) {
      factoryTxid = await this.submitFactoryRegister(
        factoryAddress,
        factoryName,
        pubkeyBuffer,
        contractAddress,
        contractName,
        projectId
      );
      await waitForTx(network, factoryTxid);
    }

    this.store.save({
      publicKeyHex: normalized,
      contractAddress,
      contractName,
      contractId,
      projectId,
      registerTxid: cached?.registerTxid ?? 'client-registered',
      factoryTxid,
      createdAt: new Date().toISOString(),
    });

    return {
      contractAddress,
      contractName,
      contractId,
      originAddress,
      alreadyRegistered: Boolean(onChain && registered),
      factoryTxid,
    };
  }

  private async lookupFactoryAccount(
    factoryAddress: string,
    factoryName: string,
    pubkey: Buffer,
    sender: string
  ): Promise<boolean> {
    const network = getNetwork(this.config.network);
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: factoryAddress,
        contractName: factoryName,
        functionName: 'lookup-account',
        functionArgs: [Cl.buffer(pubkey)],
        network,
        senderAddress: sender,
      });
      const parsed = cvToValue(result) as { type?: string; value?: unknown } | null;
      if (parsed && typeof parsed === 'object' && parsed.type === 'optional') {
        return parsed.value != null;
      }
      if (typeof parsed === 'string') return true;
      if (parsed && typeof parsed === 'object' && 'value' in parsed && parsed.value) return true;
      return false;
    } catch {
      return false;
    }
  }

  private async isContractDeployed(
    address: string,
    name: string,
    network: ReturnType<typeof getNetwork>
  ): Promise<boolean> {
    const res = await fetch(`${network.client.baseUrl}/v2/contracts/interface/${address}/${name}`);
    return res.ok;
  }

  private async isKeyRegistered(
    address: string,
    name: string,
    pubkey: Buffer,
    network: ReturnType<typeof getNetwork>,
    sender: string
  ): Promise<boolean> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'is-key-authorized',
        functionArgs: [Cl.buffer(pubkey)],
        network,
        senderAddress: sender,
      });
      const parsed = cvToValue(result) as boolean | { value?: boolean };
      return parsed === true || (typeof parsed === 'object' && parsed?.value === true);
    } catch {
      return false;
    }
  }

  private readAccountContractSource(): string {
    const path = process.env.PASSKEY_ACCOUNT_CONTRACT_PATH ?? defaultAccountContractPath();
    return readFileSync(path, 'utf8');
  }

  private async submitFactoryRegister(
    factoryAddress: string,
    factoryName: string,
    pubkey: Buffer,
    accountAddress: string,
    accountName: string,
    projectId: string
  ): Promise<string> {
    const network = getNetwork(this.config.network);
    const fee = this.config.policy.maxFeeMicroStx;
    const creds = await this.assertGas(projectId, fee);
    const senderKey = creds?.sponsorPrivateKey ?? this.config.registrarPrivateKey ?? this.config.sponsorPrivateKey;
    const lockAddress = creds?.sponsorAddress;

    const broadcastTask = () =>
      this.broadcast(projectId, fee, async () =>
        makeContractCall({
          contractAddress: factoryAddress,
          contractName: factoryName,
          functionName: 'register-account',
          functionArgs: [Cl.buffer(pubkey), Cl.contractPrincipal(accountAddress, accountName)],
          senderKey,
          network,
          fee,
        })
      );

    if (lockAddress) {
      return runWithSponsorLock(lockAddress, broadcastTask);
    }
    return broadcastTask();
  }

  private async assertGas(
    walletId: string,
    fee: bigint
  ): Promise<{ sponsorPrivateKey: string; sponsorAddress: string } | null> {
    if (!this.gasTank) return null;
    const creds = this.gasTank.getSponsorCredentials(walletId);
    if (!creds) throw new Error('Wallet not found');
    const onChain = await fetchStxBalanceMicro(creds.sponsorAddress, this.config.network);
    const available = this.gasTank.availableBalance(onChain, creds.wallet);
    if (available < fee) {
      throw new Error(
        `Insufficient gas tank balance for account operation. Deposit STX to ${creds.sponsorAddress}`
      );
    }
    this.gasTank.reserveGas(walletId, fee);
    return creds;
  }

  private async broadcast(
    projectId: string,
    fee: bigint,
    buildTx: () => Promise<Awaited<ReturnType<typeof makeContractCall>>>
  ): Promise<string> {
    const network = getNetwork(this.config.network);
    let reserved = fee;
    try {
      const txid = await broadcastWithNonceRetry(
        async () => ({ transaction: await buildTx() }),
        async (tx) =>
          broadcastTransaction({
            transaction: tx as Awaited<ReturnType<typeof makeContractCall>>,
            network,
          }) as Promise<{
            txid?: string;
            error?: string;
            reason?: string;
          }>
      );
      if (this.gasTank) {
        this.gasTank.recordSponsor(projectId, fee, txid, 'gasless', undefined, reserved);
        reserved = 0n;
      }
      return txid;
    } finally {
      if (reserved > 0n && this.gasTank) {
        this.gasTank.releaseReservation(projectId, reserved);
      }
    }
  }
}
