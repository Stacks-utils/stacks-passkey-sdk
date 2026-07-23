import { describe, it, expect } from 'vitest';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import {
  DEFAULT_SMART_ACCOUNT_NAME,
  deriveOriginPrivateKey,
  smartAccountContractId,
} from './derive-origin.js';

describe('deriveOriginPrivateKey', () => {
  const pubkey = '0372115386dd0c6ebf5f517e195d9d630cd54c1f482e505afa9a734ac437f47dbf';

  it('derives a stable secp256k1 key from passkey pubkey + rpId', () => {
    const a = deriveOriginPrivateKey(pubkey, 'localhost', 2147483648);
    const b = deriveOriginPrivateKey(pubkey, 'localhost', 2147483648);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when rpId or chainId changes', () => {
    const base = deriveOriginPrivateKey(pubkey, 'localhost', 2147483648);
    expect(deriveOriginPrivateKey(pubkey, 'example.com', 2147483648)).not.toBe(base);
    expect(deriveOriginPrivateKey(pubkey, 'localhost', 1)).not.toBe(base);
  });

  it('builds smart account contract id under origin address', () => {
    const originKey = deriveOriginPrivateKey(pubkey, 'localhost', 2147483648);
    const originAddress = getAddressFromPrivateKey(originKey, 'testnet');
    expect(smartAccountContractId(originAddress)).toBe(`${originAddress}.${DEFAULT_SMART_ACCOUNT_NAME}`);
  });
});
