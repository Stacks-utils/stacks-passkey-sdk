export const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8787';
export const ADMIN_KEY = import.meta.env.VITE_RELAY_ADMIN_API_KEY ?? 'admin-dev-change-me';

export type Project = {
  id: string;
  name: string;
  apiKey: string;
  gasBalanceMicroStx: string;
  totalSpentMicroStx: string;
  txCount: number;
  createdAt: string;
};

export type SponsorLog = {
  id: string;
  projectId: string;
  txid: string;
  feeMicroStx: string;
  billingMode: 'gasless' | 'account-pay';
  at: string;
};

export type HealthInfo = {
  ok: boolean;
  sponsorAddress?: string;
  network?: string;
};

export async function adminFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RELAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${RELAY_URL}/health`);
  if (!res.ok) throw new Error('Relay unreachable');
  return res.json() as Promise<HealthInfo>;
}

export function microStxToStx(micro: string | bigint): string {
  const n = typeof micro === 'bigint' ? micro : BigInt(micro);
  return (Number(n) / 1_000_000).toFixed(4);
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function parseAdminAllowlist(): string[] {
  const raw = import.meta.env.VITE_ADMIN_ADDRESSES as string | undefined;
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isAuthorizedAdminAddress(address: string, sponsorAddress?: string): boolean {
  const allowlist = parseAdminAllowlist();
  if (allowlist.length > 0) {
    return allowlist.some((a) => a.toLowerCase() === address.toLowerCase());
  }
  if (sponsorAddress) {
    return sponsorAddress.toLowerCase() === address.toLowerCase();
  }
  return false;
}
