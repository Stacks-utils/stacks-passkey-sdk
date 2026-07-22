import {
  Cl,
  cvToHex,
  cvToValue,
  fetchCallReadOnlyFunction,
} from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';
import { hexToBuffer } from './crypto.js';
import type { PasskeyAction, TransferAction } from './types.js';

function hashToBytes(result: Awaited<ReturnType<typeof fetchCallReadOnlyFunction>>): Uint8Array {
  return hexToBuffer(cvToHex(result));
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

  return [
    Cl.buffer(action.targetPublicKey),
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
  }
}

export function withAccountPayFee(
  action: TransferAction,
  feeRecipient: string,
  feeAmount: bigint
): TransferAction {
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
  const parsed = cvToValue(result) as { success?: boolean; value?: boolean } | boolean;
  if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
    return parsed.success === true && parsed.value === true;
  }
  return parsed === true;
}

export { ACTION_TRANSFER, ACTION_ADD_KEY, ACTION_REMOVE_KEY, ACTION_TRANSFER_WITH_FEE } from './types.js';
