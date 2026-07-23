import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GasTankStore } from './gas-tank.js';
import { deriveSponsorAddress } from './sponsor-derivation.js';
import { hashApiKey } from './crypto.js';

const MASTER = 'test-master-secret';
const OWNER = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

describe('GasTankStore', () => {
  let dir: string;
  let store: GasTankStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gas-tank-'));
    store = new GasTankStore(join(dir, 'tank.json'), MASTER, 'testnet');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates wallet with derived sponsor address', () => {
    const wallet = store.ensureWallet(OWNER);
    expect(wallet.ownerAddress).toBe(OWNER);
    expect(wallet.sponsorAddress).toBe(deriveSponsorAddress(MASTER, OWNER, 'testnet'));
  });

  it('creates hashed API keys under unified wallet tank', () => {
    const wallet = store.ensureWallet(OWNER);
    const { apiKey, record } = store.createApiKey(wallet.id, 'Demo app');
    expect(apiKey.startsWith('spk_')).toBe(true);
    expect(record.keyHash).toBe(hashApiKey(apiKey));
    expect(record.keyPrefix).toBe(apiKey.slice(0, 12));

    const resolved = store.resolveApiKey(apiKey);
    expect(resolved?.wallet.id).toBe(wallet.id);
    expect(resolved?.sponsorPrivateKey.endsWith('01')).toBe(true);
  });

  it('revokes API keys', () => {
    const wallet = store.ensureWallet(OWNER);
    const { apiKey, record } = store.createApiKey(wallet.id, 'Temp');
    expect(store.resolveApiKey(apiKey)).not.toBeNull();
    store.revokeApiKey(wallet.id, record.id);
    expect(store.resolveApiKey(apiKey)).toBeNull();
  });

  it('tracks reservations and sponsor records', () => {
    const wallet = store.ensureWallet(OWNER);
    store.reserveGas(wallet.id, 50_000n);
    const updated = store.recordSponsor(wallet.id, 50_000n, 'abc123', 'gasless', undefined, 50_000n);
    expect(updated.totalSpentMicroStx).toBe(50_000n);
    expect(updated.reservedMicroStx).toBe(0n);
    expect(updated.txCount).toBe(1);
  });

  it('rejects virtual refill', () => {
    const wallet = store.ensureWallet(OWNER);
    expect(() => store.refill(wallet.id, 100n)).toThrow(/Deposit STX/);
  });
});
