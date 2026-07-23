import type { StacksNetwork } from '@stacks/network';

export interface PasskeyConfig {
  network: StacksNetwork;
  relayUrl: string;
  /** Deployer address for passkey-factory registry and passkey-adapter. */
  deployerAddress: string;
  factoryName?: string;
  /** Universal adapter contract address (defaults to deployerAddress) */
  adapterAddress?: string;
  adapterName?: string;
  /** Contract name for self-deploy smart accounts (default `smart-account`). */
  smartAccountName?: string;
  rpId: string;
  rpName: string;
  origin: string;
}

export interface PasskeyCredential {
  credentialId: string;
  publicKey: Uint8Array;
  contractAddress: string;
  contractName: string;
  contractId: string;
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
  contractId: string;
  deployerAddress: string;
  rpId: string;
  feeMode?: FeeMode;
  /** Origin ST address that deploys and owns the smart account. */
  originAddress?: string;
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

/** Flexible optional args passed to target contract's passkey-exec router. */
export interface ContractCallArgs {
  arg0?: bigint;
  arg1?: bigint;
  arg2?: string;
  arg3?: string;
  arg4?: Uint8Array;
}

/** Default unused slot values for passkey-exec trait calls. */
export const CONTRACT_CALL_UNUSED_PRINCIPAL = 'ST000000000000000000002AMW42H';

export function normalizeContractCallArgs(args: ContractCallArgs = {}): {
  arg0: bigint;
  arg1: bigint;
  arg2: string;
  arg3: string;
  arg4: Uint8Array;
} {
  return {
    arg0: args.arg0 ?? 0n,
    arg1: args.arg1 ?? 0n,
    arg2: args.arg2 ?? CONTRACT_CALL_UNUSED_PRINCIPAL,
    arg3: args.arg3 ?? CONTRACT_CALL_UNUSED_PRINCIPAL,
    arg4: args.arg4 ?? new Uint8Array(1024),
  };
}

export interface InvokeAction {
  type: 'invoke';
  /** Full contract id: `{address}.{contract-name}` */
  contract: string;
  /** Public function routed via passkey-exec on the target contract */
  function: string;
  args?: ContractCallArgs;
}

/** @deprecated Use InvokeAction */
export type ContractCallAction = InvokeAction & { target?: string; functionName?: string };

export type PasskeyAction = TransferAction | AddKeyAction | RemoveKeyAction | InvokeAction;

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
export const ACTION_INVOKE = 5;
/** @deprecated */ export const ACTION_CONTRACT_CALL = ACTION_INVOKE;

export function resolveDeployerAddress(config: PasskeyConfig): string {
  return config.deployerAddress;
}
