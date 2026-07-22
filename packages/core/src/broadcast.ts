export interface BroadcastResult {
  txid?: string;
  error?: string;
  reason?: string;
}

export function normalizeTxId(txid: string): string {
  return txid.startsWith('0x') ? txid.slice(2) : txid;
}

export function assertBroadcastTxid(result: BroadcastResult): string {
  if (result.error || !result.txid) {
    const detail = result.reason ?? result.error ?? 'unknown error';
    throw new Error(`Transaction broadcast failed: ${detail}`);
  }
  return normalizeTxId(result.txid);
}
