import type { RelayConfig, SponsorResult } from './types.js';
import { extractContractCallId } from './contract-id.js';
import { isContractAllowed } from './rate-limit.js';
import {
  broadcastTransaction,
  deserializeTransaction,
  getAddressFromPrivateKey,
  sponsorTransaction,
  AuthType,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { GasTankStore } from './gas-tank.js';

function normalizeTxId(txid: string): string {
  return txid.startsWith('0x') ? txid.slice(2) : txid;
}

function isBadNonceResult(result: { error?: string; reason?: string }): boolean {
  const detail = `${result.error ?? ''} ${result.reason ?? ''}`;
  return /BadNonce/i.test(detail);
}

function getNetwork(name: RelayConfig['network']) {
  switch (name) {
    case 'mainnet':
      return STACKS_MAINNET;
    case 'testnet':
      return STACKS_TESTNET;
    default:
      return { ...STACKS_TESTNET, client: { ...STACKS_TESTNET.client, baseUrl: 'http://localhost:3999' } };
  }
}

export interface SponsorContext {
  projectId?: string;
  billingMode: 'gasless' | 'account-pay';
  estimatedFeeMicroStx?: bigint;
}

export class SponsorService {
  private readonly config: RelayConfig;
  private readonly network: ReturnType<typeof getNetwork>;
  private readonly gasTank?: GasTankStore;
  private sponsorQueue: Promise<unknown> = Promise.resolve();

  constructor(config: RelayConfig, gasTank?: GasTankStore) {
    this.config = config;
    this.network = getNetwork(config.network);
    this.gasTank = gasTank;
  }

  getSponsorAddress(): string {
    const network = this.config.network === 'mainnet' ? 'mainnet' : 'testnet';
    return getAddressFromPrivateKey(this.config.sponsorPrivateKey, network);
  }

  async sponsorAndBroadcast(
    txHex: string,
    context: SponsorContext = { billingMode: 'gasless' }
  ): Promise<SponsorResult & { feeChargedMicroStx?: string; gasBalanceMicroStx?: string }> {
    return this.runSerial(async () => this.sponsorAndBroadcastInner(txHex, context));
  }

  private runSerial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.sponsorQueue.then(task, task);
    this.sponsorQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async sponsorAndBroadcastInner(
    txHex: string,
    context: SponsorContext
  ): Promise<SponsorResult & { feeChargedMicroStx?: string; gasBalanceMicroStx?: string }> {
    const hex = txHex.startsWith('0x') ? txHex.slice(2) : txHex;

    let lastError = 'Transaction broadcast failed: BadNonce';
    for (let attempt = 0; attempt < 3; attempt++) {
      const transaction = deserializeTransaction(Buffer.from(hex, 'hex'));

      if (transaction.auth.authType !== AuthType.Sponsored) {
        return { txid: '', status: 'rejected', reason: 'Transaction is not marked as sponsored' };
      }

      const contractId = extractContractCallId(transaction.payload);
      if (contractId && !isContractAllowed(contractId, this.config.policy)) {
        return { txid: '', status: 'rejected', reason: `Contract not allowlisted: ${contractId}` };
      }

      const sponsoredTx = await sponsorTransaction({
        transaction,
        sponsorPrivateKey: this.config.sponsorPrivateKey,
        fee: this.config.policy.maxFeeMicroStx,
        network: this.network,
      });

      const actualFee = this.config.policy.maxFeeMicroStx;
      const response = (await broadcastTransaction({
        transaction: sponsoredTx,
        network: this.network,
      })) as { txid?: string; error?: string; reason?: string };

      if (!response.error && response.txid) {
        const txid = normalizeTxId(response.txid);
        let gasBalanceMicroStx: string | undefined;
        if (this.gasTank && context.projectId) {
          const project = this.gasTank.recordSponsor(
            context.projectId,
            BigInt(actualFee),
            txid,
            context.billingMode
          );
          gasBalanceMicroStx = project.gasBalanceMicroStx.toString();
        }

        return {
          txid,
          status: 'accepted',
          feeChargedMicroStx: actualFee.toString(),
          gasBalanceMicroStx,
        };
      }

      lastError = response.reason ?? response.error ?? lastError;
      if (!isBadNonceResult(response) || attempt === 2) {
        throw new Error(`Transaction broadcast failed: ${lastError}`);
      }
    }

    throw new Error(`Transaction broadcast failed: ${lastError}`);
  }
}
