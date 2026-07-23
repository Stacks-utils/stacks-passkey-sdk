import { describe, expect, it } from 'vitest';
import { deriveSponsorAddress, deriveSponsorPrivateKey } from './sponsor-derivation.js';

describe('sponsor derivation', () => {
  const master = 'master-secret-v1';
  const owner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

  it('is deterministic per owner address', () => {
    const a = deriveSponsorAddress(master, owner, 'testnet');
    const b = deriveSponsorAddress(master, owner, 'testnet');
    expect(a).toBe(b);
  });

  it('differs across owners', () => {
    const a = deriveSponsorAddress(master, owner, 'testnet');
    const b = deriveSponsorAddress(master, 'ST2OTHER', 'testnet');
    expect(a).not.toBe(b);
  });

  it('returns compressed private keys', () => {
    const key = deriveSponsorPrivateKey(master, owner);
    expect(key.endsWith('01')).toBe(true);
    expect(key.length).toBeGreaterThan(64);
  });
});
