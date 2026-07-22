import { describe, expect, it, vi } from 'vitest';
import { isBadNonceError, withNonceRetry } from './nonce.js';

describe('withNonceRetry', () => {
  it('retries operations that fail with BadNonce', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Transaction broadcast failed: BadNonce'))
      .mockResolvedValueOnce('ok');

    await expect(withNonceRetry(operation, 3)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry unrelated errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('InsufficientFunds'));
    await expect(withNonceRetry(operation, 3)).rejects.toThrow(/InsufficientFunds/);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('isBadNonceError', () => {
  it('detects BadNonce in error messages', () => {
    expect(isBadNonceError(new Error('Transaction broadcast failed: BadNonce'))).toBe(true);
    expect(isBadNonceError(new Error('SignatureValidation'))).toBe(false);
  });
});
