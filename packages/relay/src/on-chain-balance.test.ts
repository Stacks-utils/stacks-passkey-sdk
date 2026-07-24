import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clearStxBalanceCache, fetchStxBalanceMicro } from './on-chain-balance.js';

describe('fetchStxBalanceMicro', () => {
  beforeEach(() => {
    clearStxBalanceCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns cached balance within TTL without refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: '12345' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchStxBalanceMicro('ST123', 'testnet');
    const second = await fetchStxBalanceMicro('ST123', 'testnet');

    expect(first).toBe(12345n);
    expect(second).toBe(12345n);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to stale cache on repeated 429 responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ balance: '99999' }),
      })
      .mockResolvedValue({
        ok: false,
        status: 429,
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchStxBalanceMicro('ST999', 'testnet');
    vi.advanceTimersByTime(20_000);

    const balancePromise = fetchStxBalanceMicro('ST999', 'testnet');
    await vi.runAllTimersAsync();
    const balance = await balancePromise;

    expect(balance).toBe(99999n);
  });
});
