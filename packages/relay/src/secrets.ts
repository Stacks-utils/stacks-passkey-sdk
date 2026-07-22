import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PRIVATE_KEY_HEX = /^[0-9a-fA-F]{64}(01)?$/;

function assertSafeKeyFile(path: string): void {
  const absolute = resolve(path);
  const stat = statSync(absolute, { throwIfNoEntry: true });

  if (!stat.isFile()) {
    throw new Error(`SPONSOR_PRIVATE_KEY_FILE must point to a regular file: ${absolute}`);
  }

  // Require owner-only permissions on Unix (skip on Windows).
  if (process.platform !== 'win32') {
    const mode = stat.mode & 0o777;
    if (mode & 0o077) {
      throw new Error(
        `Insecure permissions on ${absolute} (${mode.toString(8)}). ` +
          'Run: chmod 600 <keyfile>'
      );
    }
  }
}

function normalizePrivateKey(raw: string, source: string): string {
  const key = raw.trim();
  if (!PRIVATE_KEY_HEX.test(key)) {
    throw new Error(`Invalid sponsor private key format from ${source}`);
  }
  return key.toLowerCase();
}

/**
 * Load sponsor private key from a restricted file (preferred) or env var.
 * Never log or return this value outside the relay process.
 */
export function loadSponsorPrivateKey(): string {
  const keyFile = process.env.SPONSOR_PRIVATE_KEY_FILE;
  if (keyFile) {
    assertSafeKeyFile(keyFile);
    return normalizePrivateKey(readFileSync(resolve(keyFile), 'utf8'), 'SPONSOR_PRIVATE_KEY_FILE');
  }

  const inline = process.env.SPONSOR_PRIVATE_KEY;
  if (inline) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SPONSOR_PRIVATE_KEY inline env var is disabled in production. ' +
          'Use SPONSOR_PRIVATE_KEY_FILE pointing to a chmod 600 key file.'
      );
    }
    console.warn(
      '[relay] Warning: SPONSOR_PRIVATE_KEY is set inline. Prefer SPONSOR_PRIVATE_KEY_FILE to avoid shell history leaks.'
    );
    return normalizePrivateKey(inline, 'SPONSOR_PRIVATE_KEY');
  }

  throw new Error(
    'Sponsor key not configured. Set SPONSOR_PRIVATE_KEY_FILE (recommended) or SPONSOR_PRIVATE_KEY (local dev only).'
  );
}

export function assertRelayAuthConfigured(network: string): void {
  const hasApiKey = Boolean(process.env.RELAY_API_KEY?.trim());
  const insecureLocal = process.env.RELAY_ALLOW_INSECURE_LOCAL === 'true';

  if (network === 'mainnet' && !hasApiKey) {
    throw new Error('RELAY_API_KEY is required when STACKS_NETWORK=mainnet');
  }

  if (!hasApiKey && !insecureLocal) {
    throw new Error(
      'RELAY_API_KEY is required. For local development only, set RELAY_ALLOW_INSECURE_LOCAL=true'
    );
  }

  if (!hasApiKey && insecureLocal) {
    console.warn('[relay] Warning: running without RELAY_API_KEY — local development only');
  }
}
