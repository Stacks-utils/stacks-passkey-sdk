let deployerChain: Promise<unknown> = Promise.resolve();

/** Serialize all txs from the deployer/sponsor key to avoid BadNonce races. */
export function runWithDeployerLock<T>(task: () => Promise<T>): Promise<T> {
  const next = deployerChain.then(task, task);
  deployerChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function isBadNonceResult(result: { error?: string; reason?: string }): boolean {
  const detail = `${result.error ?? ''} ${result.reason ?? ''}`;
  return /BadNonce/i.test(detail);
}

export function isBadNonceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /BadNonce/i.test(message);
}

export async function broadcastWithNonceRetry(
  buildTx: () => Promise<{ transaction: unknown }>,
  broadcast: (tx: unknown) => Promise<{ txid?: string; error?: string; reason?: string }>,
  maxAttempts = 4
): Promise<string> {
  let lastError = 'BadNonce';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { transaction: tx } = await buildTx();
    const result = await broadcast(tx);
    if (!result.error && result.txid) {
      return result.txid.startsWith('0x') ? result.txid.slice(2) : result.txid;
    }
    lastError = result.reason ?? result.error ?? lastError;
    if (!isBadNonceResult(result) || attempt === maxAttempts - 1) {
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}
