import type { StacksNetwork } from '@stacks/network';
import {
  fetchFeeEstimate,
  makeContractCall,
  PostConditionMode,
  type ClarityValue,
} from '@stacks/transactions';
import type { RelayClient } from './relay-client.js';
import { bufferToHex } from './crypto.js';
import { normalizeTxId } from './broadcast.js';
import { isBadNonceError, withNonceRetry } from './nonce.js';
import type { FeeMode } from './types.js';
import { DEFAULT_MAX_FEE_MICRO_STX } from './types.js';

export type { FeeMode };

export interface GaslessFeeOptions {
  relay: RelayClient;
}

export interface AccountPayFeeOptions {
  relay: RelayClient;
  feeRecipient: string;
  /** On-chain reimbursement pulled from the smart account (µSTX). */
  feeAmountMicroStx: bigint;
}

export interface FeeOptions {
  mode: FeeMode;
  gasless?: GaslessFeeOptions;
  accountPay?: AccountPayFeeOptions;
  maxFeeMicroStx?: bigint;
}

export type ContractCallParams = {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  originPrivateKey: string;
  network: StacksNetwork;
};

async function buildOriginSignedSponsoredTx(txOptions: ContractCallParams) {
  return makeContractCall({
    ...txOptions,
    senderKey: txOptions.originPrivateKey,
    sponsored: true,
    fee: 0n,
    postConditionMode: PostConditionMode.Allow,
    network: txOptions.network,
  });
}

export async function broadcastContractCall(
  txOptions: ContractCallParams,
  fee: FeeOptions
): Promise<string> {
  if (fee.mode === 'gasless') {
    if (!fee.gasless?.relay) {
      throw new Error('gasless mode requires fee.gasless.relay');
    }
    return withNonceRetry(async () => {
      const tx = await buildOriginSignedSponsoredTx(txOptions);
      const txHex = `0x${bufferToHex(tx.serializeBytes())}`;
      const sponsored = await fee.gasless!.relay.sponsorTransaction(txHex, { billingMode: 'gasless' });
      return normalizeTxId(sponsored.txid);
    });
  }

  if (fee.mode === 'account-pay') {
    if (!fee.accountPay?.relay) {
      throw new Error('account-pay mode requires fee.accountPay.relay');
    }
    const feeAmount = fee.accountPay.feeAmountMicroStx;
    const maxFee = fee.maxFeeMicroStx ?? DEFAULT_MAX_FEE_MICRO_STX;
    if (feeAmount > maxFee) {
      throw new Error(`Account-pay fee ${feeAmount} exceeds max ${maxFee}`);
    }
    return withNonceRetry(async () => {
      const tx = await buildOriginSignedSponsoredTx(txOptions);
      const txHex = `0x${bufferToHex(tx.serializeBytes())}`;
      const sponsored = await fee.accountPay!.relay.sponsorTransaction(txHex, {
        billingMode: 'account-pay',
        estimatedFeeMicroStx: feeAmount.toString(),
      });
      return normalizeTxId(sponsored.txid);
    });
  }

  throw new Error(`Unsupported fee mode: ${String(fee.mode)}`);
}

export async function estimateRelayFeeMicroStx(
  txOptions: ContractCallParams,
  network: StacksNetwork
): Promise<bigint> {
  const tx = await buildOriginSignedSponsoredTx({ ...txOptions, network });
  const estimate = await fetchFeeEstimate({ transaction: tx, network });
  return BigInt(estimate);
}

/** Fixed µSTX reimbursement for account-pay (matches relay sponsor fee, not fetchFeeEstimate). */
export function resolveAccountPayFeeMicroStx(options: {
  maxFeeMicroStx?: bigint;
  relaySponsorFeeMicroStx?: bigint;
}): bigint {
  return options.maxFeeMicroStx ?? options.relaySponsorFeeMicroStx ?? DEFAULT_MAX_FEE_MICRO_STX;
}

export { isBadNonceError, withNonceRetry };
