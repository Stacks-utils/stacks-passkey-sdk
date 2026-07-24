import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import type { RelayConfig } from './types.js';

function getNetwork(name: RelayConfig['network']) {
  return name === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

const CACHE_TTL_MS = 15_000;
const balanceCache = new Map<string, { balance: bigint; fetchedAt: number }>();

function cacheKey(address: string, networkName: RelayConfig['network']): string {
  return `${networkName}:${address}`;
}

function readCachedBalance(address: string, networkName: RelayConfig['network']): bigint | null {
  const entry = balanceCache.get(cacheKey(address, networkName));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
  return entry.balance;
}

function readStaleBalance(address: string, networkName: RelayConfig['network']): bigint | null {
  return balanceCache.get(cacheKey(address, networkName))?.balance ?? null;
}

function writeCachedBalance(
  address: string,
  networkName: RelayConfig['network'],
  balance: bigint
): void {
  balanceCache.set(cacheKey(address, networkName), { balance, fetchedAt: Date.now() });
}

async function fetchBalanceFromApi(
  address: string,
  networkName: RelayConfig['network']
): Promise<Response> {
  const network = getNetwork(networkName);
  return fetch(`${network.client.baseUrl}/extended/v1/address/${address}/stx`);
}

export async function fetchStxBalanceMicro(
  address: string,
  networkName: RelayConfig['network']
): Promise<bigint> {
  const cached = readCachedBalance(address, networkName);
  if (cached !== null) return cached;

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    const res = await fetchBalanceFromApi(address, networkName);
    lastStatus = res.status;
    if (res.status === 429) continue;
    if (!res.ok) {
      const stale = readStaleBalance(address, networkName);
      if (stale !== null) return stale;
      throw new Error(`Unable to fetch STX balance for ${address}: ${res.status}`);
    }
    const data = (await res.json()) as { balance?: string };
    const balance = BigInt(data.balance ?? '0');
    writeCachedBalance(address, networkName, balance);
    return balance;
  }

  const stale = readStaleBalance(address, networkName);
  if (stale !== null) return stale;
  throw new Error(`Unable to fetch STX balance for ${address}: ${lastStatus}`);
}

/** @internal test helper */
export function clearStxBalanceCache(): void {
  balanceCache.clear();
}
