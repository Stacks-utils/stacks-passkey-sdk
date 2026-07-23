const sponsorChains = new Map<string, Promise<unknown>>();

/** Serialize txs per sponsor address to avoid BadNonce races across tenants. */
export function runWithSponsorLock<T>(sponsorAddress: string, task: () => Promise<T>): Promise<T> {
  const prev = sponsorChains.get(sponsorAddress) ?? Promise.resolve();
  const next = prev.then(task, task);
  sponsorChains.set(
    sponsorAddress,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}
