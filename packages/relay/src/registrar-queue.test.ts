import { describe, it, expect } from 'vitest';
import { runWithDeployerLock, isBadNonceResult } from './registrar-queue.js';

describe('registrar-queue', () => {
  it('detects BadNonce in broadcast results', () => {
    expect(isBadNonceResult({ reason: 'BadNonce' })).toBe(true);
    expect(isBadNonceResult({ error: 'transaction rejected' })).toBe(false);
  });

  it('runs deployer tasks serially', async () => {
    const order: number[] = [];
    await Promise.all([
      runWithDeployerLock(async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 20));
        order.push(2);
      }),
      runWithDeployerLock(async () => {
        order.push(3);
      }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });
});
