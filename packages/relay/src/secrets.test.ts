import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('loadSponsorPrivateKey', () => {
  it('loads from a restricted key file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'relay-key-'));
    const file = join(dir, 'sponsor.key');
    writeFileSync(file, VALID_KEY);
    chmodSync(file, 0o600);

    process.env.SPONSOR_PRIVATE_KEY_FILE = file;
    delete process.env.SPONSOR_PRIVATE_KEY;

    const { loadSponsorPrivateKey } = await import('./secrets.js');
    expect(loadSponsorPrivateKey()).toBe(VALID_KEY);

    delete process.env.SPONSOR_PRIVATE_KEY_FILE;
  });

  it('rejects world-readable key files on unix', async () => {
    if (process.platform === 'win32') return;

    const dir = mkdtempSync(join(tmpdir(), 'relay-key-'));
    const file = join(dir, 'sponsor.key');
    writeFileSync(file, VALID_KEY);
    chmodSync(file, 0o644);

    process.env.SPONSOR_PRIVATE_KEY_FILE = file;
    delete process.env.SPONSOR_PRIVATE_KEY;

    const { loadSponsorPrivateKey } = await import('./secrets.js');
    expect(() => loadSponsorPrivateKey()).toThrow(/chmod 600/);

    delete process.env.SPONSOR_PRIVATE_KEY_FILE;
  });
});

describe('assertRelayAuthConfigured', () => {
  it('requires api key on mainnet', async () => {
    delete process.env.RELAY_API_KEY;
    delete process.env.RELAY_ALLOW_INSECURE_LOCAL;
    const { assertRelayAuthConfigured } = await import('./secrets.js');
    expect(() => assertRelayAuthConfigured('mainnet')).toThrow(/RELAY_API_KEY/);
  });
});
