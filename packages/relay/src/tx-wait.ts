import type { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

type Network = typeof STACKS_MAINNET | typeof STACKS_TESTNET;

export async function waitForTx(
  network: Network,
  txid: string,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<void> {
  const normalized = txid.startsWith('0x') ? txid.slice(2) : txid;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${network.client.baseUrl}/extended/v1/tx/${normalized}`);
    if (!res.ok) continue;
    const data = (await res.json()) as { tx_status: string; tx_result?: { repr?: string } };
    if (data.tx_status === 'success') return;
    if (data.tx_status === 'abort_by_response' || data.tx_status === 'failed') {
      const detail = data.tx_result?.repr ?? data.tx_status;
      throw new Error(`Transaction failed on chain: ${detail}`);
    }
  }
  throw new Error(`Transaction ${normalized} was not confirmed on chain`);
}
