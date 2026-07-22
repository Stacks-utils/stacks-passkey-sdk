import type { StacksNetwork } from '@stacks/network';

export interface PasskeyConfig {
  network: StacksNetwork;
  relayUrl: string;
  contractAddress: string;
  contractName: string;
  rpId: string;
  rpName: string;
  origin: string;
}

export interface PasskeyCredential {
  credentialId: string;
  publicKey: Uint8Array;
  contractAddress: string;
  contractName: string;
  txid: string;
}

export interface WebAuthnAssertion {
  signature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}

export interface PasskeySession {
  credentialId: string;
  publicKeyHex: string;
  contractAddress: string;
  contractName: string;
  rpId: string;
  feeMode?: FeeMode;
}

export interface TransferAction {
  type: 'transfer';
  recipient: string;
  amount: bigint;
  feeRecipient?: string;
  feeAmount?: bigint;
}

export type FeeMode = 'gasless' | 'account-pay';

export interface FeeConfig {
  mode: FeeMode;
  /** Required for gasless and account-pay (registration uses gasless). */
  relayUrl?: string;
  relayApiKey?: string;
  /** Account-pay: relayer address that receives fee reimbursement from contract STX. */
  feeRecipient?: string;
  maxFeeMicroStx?: bigint;
}

export interface AddKeyAction {
  type: 'add-key';
  newPublicKey: Uint8Array;
}

export interface RemoveKeyAction {
  type: 'remove-key';
  targetPublicKey: Uint8Array;
}

export type PasskeyAction = TransferAction | AddKeyAction | RemoveKeyAction;

export interface SponsorResponse {
  txid: string;
  status: 'accepted' | 'rejected';
  reason?: string;
  feeChargedMicroStx?: string;
  gasBalanceMicroStx?: string;
}

export interface SponsorRequestOptions {
  billingMode?: 'gasless' | 'account-pay';
  estimatedFeeMicroStx?: string;
}

export const ACTION_TRANSFER = 1;
export const ACTION_ADD_KEY = 2;
export const ACTION_REMOVE_KEY = 3;
export const ACTION_TRANSFER_WITH_FEE = 4;
