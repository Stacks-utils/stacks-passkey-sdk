import { getAddressFromPrivateKey } from '@stacks/transactions';
import type { RelayConfig } from './types.js';

/** Platform deployer key — required sender for passkey-factory and passkey-adapter registrar functions. */
export function platformRegistrarPrivateKey(config: RelayConfig): string {
  return config.registrarPrivateKey ?? config.sponsorPrivateKey;
}

export function platformRegistrarAddress(config: RelayConfig): string {
  const network = config.network === 'mainnet' ? 'mainnet' : 'testnet';
  return getAddressFromPrivateKey(platformRegistrarPrivateKey(config), network);
}
