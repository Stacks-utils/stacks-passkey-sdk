import {
  Cl,
  cvToValue,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';
import { hexToBuffer } from './crypto.js';
import type { ContractCallArgs, InvokeAction, PasskeyAction, TransferAction } from './types.js';
import { normalizeContractCallArgs } from './types.js';

function clarityValueToBytes(parsed: unknown): Uint8Array {
  if (parsed instanceof Uint8Array) return parsed;
  if (typeof parsed === 'string') return hexToBuffer(parsed);
  if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
    const wrapped = parsed as { value: unknown; success?: boolean };
    if (wrapped.success === false) {
      throw new Error(`Contract read-only call failed: ${JSON.stringify(wrapped.value)}`);
    }
    return clarityValueToBytes(wrapped.value);
  }
  throw new Error('Unexpected action hash from contract read-only call');
}

function clarityValueToBool(parsed: unknown): boolean {
  if (parsed === true) return true;
  if (parsed === false) return false;
  if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
    const wrapped = parsed as { value: unknown; success?: boolean };
    if (wrapped.success === false) return false;
    return clarityValueToBool(wrapped.value);
  }
  return false;
}

function hashToBytes(result: Awaited<ReturnType<typeof fetchCallReadOnlyFunction>>): Uint8Array {
  return clarityValueToBytes(cvToValue(result));
}

function parseContractId(contractId: string): { address: string; name: string } {
  const dot = contractId.indexOf('.');
  if (dot === -1) {
    throw new Error('invoke contract must be address.contract-name');
  }
  return { address: contractId.slice(0, dot), name: contractId.slice(dot + 1) };
}

export function resolveInvokeAction(action: InvokeAction): {
  contract: string;
  function: string;
  args?: ContractCallArgs;
} {
  const contract = action.contract ?? (action as { target?: string }).target;
  const fn = action.function ?? (action as { functionName?: string }).functionName;
  if (!contract || !fn) {
    throw new Error('invoke action requires contract and function');
  }
  return { contract, function: fn, args: action.args };
}

export function buildInvokeArgs(args: ContractCallArgs = {}): ClarityValue[] {
  return buildContractCallArgs(args);
}

export function buildContractCallArgs(args: ContractCallArgs = {}): ClarityValue[] {
  const normalized = normalizeContractCallArgs(args);
  return [
    Cl.uint(normalized.arg0),
    Cl.uint(normalized.arg1),
    Cl.principal(normalized.arg2),
    Cl.principal(normalized.arg3),
    Cl.buffer(normalized.arg4),
  ];
}

export async function fetchActionHash(
  network: StacksNetwork,
  contractAddress: string,
  contractName: string,
  action: PasskeyAction,
  senderAddress: string
): Promise<Uint8Array> {
  if (action.type === 'transfer') {
    if (action.feeRecipient !== undefined && action.feeAmount !== undefined) {
      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'compute-transfer-with-fee-hash',
        functionArgs: [
          Cl.principal(action.recipient),
          Cl.uint(action.amount),
          Cl.principal(action.feeRecipient),
          Cl.uint(action.feeAmount),
        ],
        network,
        senderAddress,
      });
      return hashToBytes(result);
    }

    const result = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: 'compute-transfer-hash',
      functionArgs: [Cl.principal(action.recipient), Cl.uint(action.amount)],
      network,
      senderAddress,
    });
    return hashToBytes(result);
  }

  if (action.type === 'add-key') {
    const result = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: 'compute-add-key-hash',
      functionArgs: [Cl.buffer(action.newPublicKey)],
      network,
      senderAddress,
    });
    return hashToBytes(result);
  }

  if (action.type === 'remove-key') {
    const result = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: 'compute-remove-key-hash',
      functionArgs: [Cl.buffer(action.targetPublicKey)],
      network,
      senderAddress,
    });
    return hashToBytes(result);
  }

  const { contract, function: functionName, args } = resolveInvokeAction(action);
  const normalized = normalizeContractCallArgs(args);
  if (action.type === 'invoke' && action.feeRecipient !== undefined && action.feeAmount !== undefined) {
    const { address, name } = parseContractId(contract);
    const target = `${address}.${name}`;
    const result = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: 'compute-invoke-with-fee-hash',
      functionArgs: [
        Cl.principal(target),
        Cl.stringAscii(functionName),
        Cl.uint(normalized.arg0),
        Cl.uint(normalized.arg1),
        Cl.principal(normalized.arg2),
        Cl.principal(normalized.arg3),
        Cl.buffer(normalized.arg4),
        Cl.principal(action.feeRecipient),
        Cl.uint(action.feeAmount),
      ],
      network,
      senderAddress,
    });
    return hashToBytes(result);
  }

  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: 'compute-invoke-hash',
    functionArgs: [
      Cl.principal(contract),
      Cl.stringAscii(functionName),
      Cl.uint(normalized.arg0),
      Cl.uint(normalized.arg1),
      Cl.principal(normalized.arg2),
      Cl.principal(normalized.arg3),
      Cl.buffer(normalized.arg4),
    ],
    network,
    senderAddress,
  });
  return hashToBytes(result);
}

export function buildExecuteFunctionArgs(
  action: PasskeyAction,
  publicKey: Uint8Array,
  signature: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array
) {
  const webAuthnArgs = [
    Cl.buffer(signature),
    Cl.buffer(authenticatorData),
    Cl.buffer(clientDataJSON),
  ];

  if (action.type === 'transfer') {
    if (action.feeRecipient !== undefined && action.feeAmount !== undefined) {
      return [
        Cl.principal(action.recipient),
        Cl.uint(action.amount),
        Cl.principal(action.feeRecipient),
        Cl.uint(action.feeAmount),
        Cl.buffer(publicKey),
        ...webAuthnArgs,
      ];
    }

    return [
      Cl.principal(action.recipient),
      Cl.uint(action.amount),
      Cl.buffer(publicKey),
      ...webAuthnArgs,
    ];
  }

  if (action.type === 'add-key') {
    return [
      Cl.buffer(action.newPublicKey),
      Cl.buffer(publicKey),
      ...webAuthnArgs,
    ];
  }

  if (action.type === 'remove-key') {
    return [
      Cl.buffer(action.targetPublicKey),
      Cl.buffer(publicKey),
      ...webAuthnArgs,
    ];
  }

  const { contract, function: functionName, args } = resolveInvokeAction(action);
  const { address, name } = parseContractId(contract);
  if (action.type === 'invoke' && action.feeRecipient !== undefined && action.feeAmount !== undefined) {
    return [
      Cl.contractPrincipal(address, name),
      Cl.stringAscii(functionName),
      ...buildInvokeArgs(args),
      Cl.principal(action.feeRecipient),
      Cl.uint(action.feeAmount),
      Cl.buffer(publicKey),
      ...webAuthnArgs,
    ];
  }

  return [
    Cl.contractPrincipal(address, name),
    Cl.stringAscii(functionName),
    ...buildInvokeArgs(args),
    Cl.buffer(publicKey),
    ...webAuthnArgs,
  ];
}

export function getExecuteFunctionName(action: PasskeyAction): string {
  switch (action.type) {
    case 'transfer':
      if (action.feeRecipient !== undefined && action.feeAmount !== undefined) {
        return 'transfer-stx-with-fee';
      }
      return 'transfer-stx';
    case 'add-key':
      return 'add-key';
    case 'remove-key':
      return 'remove-key';
    case 'invoke':
      if (action.feeRecipient !== undefined && action.feeAmount !== undefined) {
        return 'execute-via-adapter-with-fee';
      }
      return 'execute-via-adapter';
  }
}

export function withAccountPayFee(
  action: TransferAction,
  feeRecipient: string,
  feeAmount: bigint
): TransferAction {
  return { ...action, feeRecipient, feeAmount };
}

export function withAccountPayInvokeFee(
  action: InvokeAction,
  feeRecipient: string,
  feeAmount: bigint
): InvokeAction {
  return { ...action, feeRecipient, feeAmount };
}

export async function isPublicKeyAuthorized(
  network: StacksNetwork,
  contractAddress: string,
  contractName: string,
  publicKey: Uint8Array,
  senderAddress: string
): Promise<boolean> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: 'is-key-authorized',
    functionArgs: [Cl.buffer(publicKey)],
    network,
    senderAddress,
  });
  const parsed = cvToValue(result);
  return clarityValueToBool(parsed);
}

export async function isContractRegistered(
  network: StacksNetwork,
  adapterAddress: string,
  adapterName: string,
  contractId: string,
  senderAddress: string
): Promise<boolean> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: adapterAddress,
      contractName: adapterName,
      functionName: 'is-registered',
      functionArgs: [Cl.principal(contractId)],
      network,
      senderAddress,
    });
    const parsed = cvToValue(result);
    return clarityValueToBool(parsed);
  } catch {
    return false;
  }
}

export function createInvokeAction(
  contract: string,
  fn: string,
  args?: ContractCallArgs
): InvokeAction {
  return { type: 'invoke', contract, function: fn, args };
}

/** @deprecated Use createInvokeAction */
export function createContractCallAction(
  target: string,
  functionName: string,
  args?: ContractCallArgs
): InvokeAction {
  return createInvokeAction(target, functionName, args);
}

export {
  ACTION_TRANSFER,
  ACTION_ADD_KEY,
  ACTION_REMOVE_KEY,
  ACTION_TRANSFER_WITH_FEE,
  ACTION_INVOKE,
  ACTION_CONTRACT_CALL,
} from './types.js';
