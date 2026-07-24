import type { RelayConfig, SponsorResult } from './types.js';
import { extractContractCallId } from './contract-id.js';
import { isContractAllowed } from './rate-limit.js';
import {
  broadcastTransaction,
  deserializeTransaction,
  getAddressFromPrivateKey,
  sponsorTransaction,
  AuthType,
  isSmartContractPayload,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { GasTankStore } from './gas-tank.js';
import { isBadNonceResult } from './registrar-queue.js';
import { runWithSponsorLock } from './sponsor-lock.js';
import { fetchStxBalanceMicro } from './on-chain-balance.js';

function normalizeTxId(txid: string): string {
  return txid.startsWith('0x') ? txid.slice(2) : txid;
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
  walletId?: string;
  apiKeyId?: string;
  sponsorPrivateKey?: string;
  sponsorAddress?: string;
  billingMode: 'gasless' | 'account-pay';
  estimatedFeeMicroStx?: bigint;
}

export class SponsorService {
  private readonly config: RelayConfig;
  private readonly network: ReturnType<typeof getNetwork>;
  private readonly gasTank?: GasTankStore;

  constructor(config: RelayConfig, gasTank?: GasTankStore) {
    this.config = config;
    this.network = getNetwork(config.network);
    this.gasTank = gasTank;
  }

  getRegistrarAddress(): string {
    const network = this.config.network === 'mainnet' ? 'mainnet' : 'testnet';
    const key = this.config.registrarPrivateKey ?? this.config.sponsorPrivateKey;
    return getAddressFromPrivateKey(key, network);
  }

  /** Platform registrar / legacy sponsor address */
  getSponsorAddress(): string {
    return this.getRegistrarAddress();
  }

  async sponsorAndBroadcast(
    txHex: string,
    context: SponsorContext = { billingMode: 'gasless' }
  ): Promise<SponsorResult & { feeChargedMicroStx?: string; gasBalanceMicroStx?: string }> {
    const sponsorPrivateKey = context.sponsorPrivateKey ?? this.config.sponsorPrivateKey;
    const sponsorAddress =
      context.sponsorAddress ??
      getAddressFromPrivateKey(
        sponsorPrivateKey,
        this.config.network === 'mainnet' ? 'mainnet' : 'testnet'
      );

    return runWithSponsorLock(sponsorAddress, () =>
      this.sponsorAndBroadcastInner(txHex, { ...context, sponsorPrivateKey, sponsorAddress })
    );
  }

  private async sponsorAndBroadcastInner(
    txHex: string,
    context: SponsorContext & { sponsorPrivateKey: string; sponsorAddress: string }
  ): Promise<SponsorResult & { feeChargedMicroStx?: string; gasBalanceMicroStx?: string }> {
    const hex = txHex.startsWith('0x') ? txHex.slice(2) : txHex;
    const deployFeeMultiplier = 4n;
    const transactionPreview = deserializeTransaction(Buffer.from(hex, 'hex'));
    const configuredFee = isSmartContractPayload(transactionPreview.payload)
      ? this.config.policy.maxFeeMicroStx * deployFeeMultiplier
      : this.config.policy.maxFeeMicroStx;
    const actualFee =
      context.billingMode === 'account-pay'
        ? configuredFee
        : context.estimatedFeeMicroStx && context.estimatedFeeMicroStx > configuredFee
          ? context.estimatedFeeMicroStx
          : configuredFee;

    let reserved = false;
    if (this.gasTank && context.walletId && context.billingMode === 'gasless') {
      const wallet = this.gasTank.getWalletById(context.walletId);
      if (!wallet) {
        return { txid: '', status: 'rejected', reason: 'Wallet not found' };
      }
      const onChain = await fetchStxBalanceMicro(context.sponsorAddress, this.config.network);
      const available = this.gasTank.availableBalance(onChain, wallet);
      if (available < actualFee) {
        return {
          txid: '',
          status: 'rejected',
          reason: `Insufficient gas tank balance at ${context.sponsorAddress}`,
        };
      }
      this.gasTank.reserveGas(context.walletId, actualFee);
      reserved = true;
    }

    let lastError = 'Transaction broadcast failed: BadNonce';
    try {
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
          sponsorPrivateKey: context.sponsorPrivateKey,
          fee: actualFee,
          network: this.network,
        });
        const response = (await broadcastTransaction({
          transaction: sponsoredTx,
          network: this.network,
        })) as { txid?: string; error?: string; reason?: string };

        if (!response.error && response.txid) {
          const txid = normalizeTxId(response.txid);
          let gasBalanceMicroStx: string | undefined;
          if (this.gasTank && context.walletId) {
            const wallet = this.gasTank.recordSponsor(
              context.walletId,
              BigInt(actualFee),
              txid,
              context.billingMode,
              context.apiKeyId,
              reserved ? actualFee : undefined
            );
            reserved = false;
            const onChain = await fetchStxBalanceMicro(context.sponsorAddress, this.config.network);
            gasBalanceMicroStx = this.gasTank.availableBalance(onChain, wallet).toString();
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
    } catch (error) {
      if (reserved && this.gasTank && context.walletId) {
        this.gasTank.releaseReservation(context.walletId, actualFee);
      }
      throw error;
    }

    if (reserved && this.gasTank && context.walletId) {
      this.gasTank.releaseReservation(context.walletId, actualFee);
    }
    throw new Error(`Transaction broadcast failed: ${lastError}`);
  }
}
