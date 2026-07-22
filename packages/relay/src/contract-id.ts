import {
  addressToString,
  isContractCallPayload,
  type PayloadWire,
} from '@stacks/transactions';

export function extractContractCallId(payload: PayloadWire): string | null {
  if (!isContractCallPayload(payload)) return null;
  return `${addressToString(payload.contractAddress)}.${payload.contractName.content}`;
}
