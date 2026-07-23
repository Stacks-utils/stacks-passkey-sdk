import { createHmac } from 'node:crypto';
import { getAddressFromPrivateKey } from '@stacks/transactions';

const DERIVATION_LABEL = 'stacks-passkey-sponsor-v1';

/** Deterministic sponsor private key per wallet owner (compressed hex). */
export function deriveSponsorPrivateKey(masterSecret: string, ownerAddress: string): string {
  for (let counter = 0; counter < 256; counter++) {
    const digest = createHmac('sha256', masterSecret)
      .update(DERIVATION_LABEL)
      .update(ownerAddress)
      .update(Buffer.from([counter]))
      .digest('hex');
    const candidate = `${digest}01`;
    try {
      getAddressFromPrivateKey(candidate, 'testnet');
      return candidate;
    } catch {
      // try next counter
    }
  }
  throw new Error('Unable to derive sponsor private key');
}

export function deriveSponsorAddress(
  masterSecret: string,
  ownerAddress: string,
  network: 'mainnet' | 'testnet'
): string {
  return getAddressFromPrivateKey(deriveSponsorPrivateKey(masterSecret, ownerAddress), network);
}
