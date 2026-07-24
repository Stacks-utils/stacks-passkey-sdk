const LOCAL_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
] as const;

/** Default browser origins for the hosted testnet demo portal. */
const HOSTED_DEMO_ORIGINS = ['https://stacks-passkey-sdk-demo.vercel.app'] as const;

export function parseCorsOriginEntries(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveCorsOriginEntries(env: NodeJS.ProcessEnv = process.env): string[] {
  const fromEnv = parseCorsOriginEntries(env.CORS_ORIGINS);
  return [...new Set([...LOCAL_CORS_ORIGINS, ...HOSTED_DEMO_ORIGINS, ...fromEnv])];
}

/** Supports exact origins and wildcard suffix entries like `*.vercel.app`. */
export function isCorsOriginAllowed(origin: string, allowedEntries: string[]): boolean {
  for (const entry of allowedEntries) {
    if (entry === origin) return true;
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1);
      try {
        const url = new URL(origin);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
        if (url.host.endsWith(suffix)) return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

export function createCorsOriginMatcher(env: NodeJS.ProcessEnv = process.env) {
  const allowedEntries = resolveCorsOriginEntries(env);
  return (origin: string) => (isCorsOriginAllowed(origin, allowedEntries) ? origin : '');
}
