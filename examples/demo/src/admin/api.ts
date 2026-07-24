import { testnetConfig } from '../config.js';

export const RELAY_URL = testnetConfig.relayUrl;

const SESSION_KEY = 'relay-admin-session';
const KEY_CACHE_KEY = 'relay-admin-api-key-cache';

type ApiKeyCache = Record<string, string>;

function readApiKeyCache(): ApiKeyCache {
  try {
    const raw = localStorage.getItem(KEY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ApiKeyCache) : {};
  } catch {
    return {};
  }
}

export function cacheApiKey(keyId: string, apiKey: string): void {
  const cache = readApiKeyCache();
  cache[keyId] = apiKey;
  localStorage.setItem(KEY_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedApiKey(keyId: string): string | null {
  return readApiKeyCache()[keyId] ?? null;
}

export function removeCachedApiKey(keyId: string): void {
  const cache = readApiKeyCache();
  delete cache[keyId];
  localStorage.setItem(KEY_CACHE_KEY, JSON.stringify(cache));
}

export async function revealApiKey(keyId: string): Promise<string> {
  const { apiKey } = await walletFetch<{ apiKey: string }>(`/v1/wallet/keys/${keyId}/reveal`);
  cacheApiKey(keyId, apiKey);
  return apiKey;
}

export type WalletInfo = {
  walletId: string;
  ownerAddress: string;
  sponsorAddress: string;
  gasBalanceMicroStx: string;
  availableMicroStx: string;
  reservedMicroStx: string;
  totalSpentMicroStx: string;
  txCount: number;
  createdAt: string;
};

export type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  /** Relay has plaintext on file (local dev only). */
  retrievable?: boolean;
};

export type ApiKeyCreated = ApiKeySummary & {
  apiKey: string;
  warning?: string;
};

export type SponsorLog = {
  id: string;
  walletId: string;
  apiKeyId?: string;
  txid: string;
  feeMicroStx: string;
  billingMode: 'gasless' | 'account-pay';
  at: string;
};

export type AuthChallenge = {
  address: string;
  nonce: string;
  expiresAt: number;
  plainMessage: string;
  domain: {
    name: string;
    version: string;
    'chain-id': number;
  };
  message: {
    action: string;
    address: string;
    nonce: string;
    expires: number;
  };
};

export type HealthInfo = {
  ok: boolean;
  registrarAddress?: string;
  network?: string;
  auth?: string;
};

type StoredSession = { token: string; expiresAt: number; address?: string };

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return readStoredSession()?.token ?? null;
}

export function getSessionAddress(): string | null {
  return readStoredSession()?.address ?? null;
}

export function setSessionToken(token: string, expiresAt: number, address: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt, address }));
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${RELAY_URL}/health`);
  if (!res.ok) throw new Error('Relay unreachable');
  return res.json() as Promise<HealthInfo>;
}

export async function fetchAuthChallenge(address: string): Promise<AuthChallenge> {
  const res = await fetch(`${RELAY_URL}/v1/auth/challenge?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AuthChallenge>;
}

export async function verifyAuth(body: {
  address: string;
  signature: string;
  publicKey: string;
  nonce: string;
  expiresAt: number;
  mode?: 'structured' | 'plain';
  plainMessage?: string;
}): Promise<{ sessionToken: string; expiresAt: number; address: string }> {
  const res = await fetch(`${RELAY_URL}/v1/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ sessionToken: string; expiresAt: number; address: string }>;
}

export async function walletFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken();
  if (!token) throw new Error('Not authenticated — connect wallet and sign in');
  const res = await fetch(`${RELAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function microStxToStx(micro: string | bigint): string {
  const n = typeof micro === 'bigint' ? micro : BigInt(micro);
  return (Number(n) / 1_000_000).toFixed(4);
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
