import { Cl, cvToValue, fetchCallReadOnlyFunction } from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';
import { testnetConfig } from './config.js';

function parseContractId(contractId: string): { address: string; name: string } {
  const dot = contractId.indexOf('.');
  if (dot === -1) throw new Error('contractId must be address.name');
  return { address: contractId.slice(0, dot), name: contractId.slice(dot + 1) };
}

function unwrapUint(parsed: unknown): bigint {
  if (typeof parsed === 'bigint') return parsed;
  if (typeof parsed === 'number') return BigInt(parsed);
  if (typeof parsed === 'string') return BigInt(parsed);
  if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
    const wrapped = parsed as { value: unknown; success?: boolean };
    if (wrapped.success === false) {
      throw new Error(`Read-only call failed: ${JSON.stringify(wrapped.value)}`);
    }
    return unwrapUint(wrapped.value);
  }
  throw new Error('Unexpected read-only uint response');
}

/** Read `get-score` from the demo app for a user principal (no wallet signature). */
export async function fetchDemoScore(network: StacksNetwork, userPrincipal: string): Promise<bigint> {
  const { address, name } = parseContractId(testnetConfig.passkeyDemoAppId);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: address,
    contractName: name,
    functionName: 'get-score',
    functionArgs: [Cl.principal(userPrincipal)],
    network,
    senderAddress: userPrincipal,
  });
  return unwrapUint(cvToValue(result));
}
