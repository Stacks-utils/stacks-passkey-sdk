import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findStoredCredentialById,
  findStoredCredentialByIdRelaxed,
  findStoredCredentials,
  findStoredCredentialsByRpId,
  loadStoredCredentials,
  normalizeRpId,
  rpIdsEquivalent,
  saveStoredCredential,
  type StoredCredential,
} from './credentials.js';

const CREDENTIAL: StoredCredential = {
  credentialId: 'cred-1',
  publicKeyHex: '0xabc',
  contractAddress: 'ST1ORIGIN',
  contractName: 'smart-account',
  contractId: 'ST1ORIGIN.smart-account',
  deployerAddress: 'ST3DEPLOYER',
  rpId: '127.0.0.1',
};

describe('credentials', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  it('normalizes loopback rpIds to localhost', () => {
    expect(normalizeRpId('127.0.0.1')).toBe('localhost');
    expect(normalizeRpId('[::1]')).toBe('localhost');
    expect(rpIdsEquivalent('127.0.0.1', 'localhost')).toBe(true);
  });

  it('stores credentials with normalized rpId', () => {
    saveStoredCredential(CREDENTIAL);
    const stored = loadStoredCredentials();
    expect(stored[0]?.rpId).toBe('localhost');
  });

  it('finds credentials across loopback rpId variants', () => {
    saveStoredCredential(CREDENTIAL);
    expect(findStoredCredentials({ deployerAddress: 'ST3DEPLOYER', rpId: 'localhost' })).toHaveLength(1);
    expect(findStoredCredentialsByRpId('127.0.0.1')).toHaveLength(1);
  });

  it('falls back to rpId-only lookup when deployer differs', () => {
    saveStoredCredential(CREDENTIAL);
    expect(findStoredCredentials({ deployerAddress: 'ST_OTHER', rpId: 'localhost' })).toHaveLength(0);
    expect(findStoredCredentialsByRpId('localhost')).toHaveLength(1);
    expect(findStoredCredentialByIdRelaxed('cred-1', 'localhost')).not.toBeNull();
  });

  it('resolves credential id with strict then relaxed filters', () => {
    saveStoredCredential(CREDENTIAL);
    expect(findStoredCredentialById('cred-1', { deployerAddress: 'ST3DEPLOYER', rpId: 'localhost' })).not.toBeNull();
  });
});
