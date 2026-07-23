import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { RelayConfig } from './types.js';

function getNetwork(name: RelayConfig['network']) {
  return name === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

export async function fetchStxBalanceMicro(
  address: string,
  networkName: RelayConfig['network']
): Promise<bigint> {
  const network = getNetwork(networkName);
  const res = await fetch(`${network.client.baseUrl}/extended/v1/address/${address}/stx`);
  if (!res.ok) {
    throw new Error(`Unable to fetch STX balance for ${address}: ${res.status}`);
  }
  const data = (await res.json()) as { balance?: string };
  return BigInt(data.balance ?? '0');
}
