import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function generateApiKey(): string {
  return `spk_${randomBytes(24).toString('hex')}`;
}

export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}

export function createSessionToken(address: string, secret: string, ttlMs = 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = JSON.stringify({ address, exp });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): { address: string } | null {
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      address: string;
      exp: number;
    };
    if (!payload.address || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return { address: payload.address };
  } catch {
    return null;
  }
}

export function loadMasterSecret(): string {
  const explicit = process.env.RELAY_MASTER_SECRET?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RELAY_MASTER_SECRET is required in production for per-wallet sponsor derivation');
  }
  const fallback = process.env.RELAY_SESSION_SECRET?.trim() ?? 'dev-master-secret-change-me';
  console.warn('[relay] Warning: RELAY_MASTER_SECRET not set — using dev fallback (local only)');
  return fallback;
}

export function loadSessionSecret(): string {
  const secret = process.env.RELAY_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RELAY_SESSION_SECRET is required in production');
  }
  console.warn('[relay] Warning: RELAY_SESSION_SECRET not set — using dev fallback (local only)');
  return 'dev-session-secret-change-me';
}
