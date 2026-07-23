import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { hexToBuffer } from './crypto.js';

/** Fixed contract name for user-origin self-deployed smart accounts. */
export const DEFAULT_SMART_ACCOUNT_NAME = 'smart-account';

/**
 * Deterministic secp256k1 origin key scoped to passkey pubkey + app identity.
 * Same passkey on the same rpId always yields the same ST… deployer address.
 */
export function deriveOriginPrivateKey(publicKeyHex: string, rpId: string, chainId: number): string {
  const normalized = publicKeyHex.toLowerCase().replace(/^0x/, '');
  const ikm = hexToBuffer(normalized);
  const salt = new TextEncoder().encode(rpId);
  const info = new TextEncoder().encode(`stacks-passkey-origin:v1:${chainId}`);
  const seed = hkdf(sha256, ikm, salt, info, 32);
  const scalar = secp256k1.utils.normPrivateKeyToScalar(seed);
  return scalar.toString(16).padStart(64, '0');
}

export function smartAccountContractId(originAddress: string, contractName = DEFAULT_SMART_ACCOUNT_NAME): string {
  return `${originAddress}.${contractName}`;
}

export function originKeyScopeForAddress(originAddress: string, network: string): string {
  return `${originAddress}:${network}`;
}
