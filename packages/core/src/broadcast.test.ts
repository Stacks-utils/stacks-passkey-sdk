import { describe, expect, it } from 'vitest';
import { assertBroadcastTxid, normalizeTxId } from './broadcast.js';

describe('assertBroadcastTxid', () => {
  it('returns txid for successful broadcasts', () => {
    expect(assertBroadcastTxid({ txid: 'abc123' })).toBe('abc123');
  });

  it('throws when broadcast failed but includes a txid', () => {
    expect(() =>
      assertBroadcastTxid({
        error: 'transaction rejected',
        reason: 'SignatureValidation',
        txid: '229c07e6c130e317bb25338adf9bc2e01906509d505b9b126646082d1522d373',
      })
    ).toThrow(/broadcast failed/i);
  });

  it('strips 0x prefix from txids', () => {
    expect(normalizeTxId('0xabc123')).toBe('abc123');
    expect(assertBroadcastTxid({ txid: '0xabc123' })).toBe('abc123');
  });
});
