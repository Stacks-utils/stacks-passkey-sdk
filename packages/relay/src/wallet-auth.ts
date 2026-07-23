import { randomBytes } from 'node:crypto';
import {
  Cl,
  encodeStructuredDataBytes,
  getAddressFromPublicKey,
  publicKeyFromSignatureRsv,
} from '@stacks/transactions';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, utf8ToBytes } from '@stacks/common';
import type { RelayConfig } from './types.js';
import { createSessionToken } from './crypto.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface PendingChallenge {
  nonce: string;
  expiresAt: number;
}

const pendingChallenges = new Map<string, PendingChallenge>();

function chainIdForNetwork(network: RelayConfig['network']): number {
  return network === 'mainnet' ? 1 : 0x80000000;
}

export function relayAuthDomain(network: RelayConfig['network']) {
  const domainName = process.env.RELAY_AUTH_DOMAIN ?? 'localhost';
  return Cl.tuple({
    name: Cl.stringAscii(domainName),
    version: Cl.stringAscii('1.0.0'),
    'chain-id': Cl.uint(chainIdForNetwork(network)),
  });
}

export function buildAuthMessage(address: string, nonce: string, expiresAt: number) {
  return Cl.tuple({
    action: Cl.stringAscii('authenticate'),
    address: Cl.stringAscii(address),
    nonce: Cl.stringAscii(nonce),
    expires: Cl.uint(expiresAt),
  });
}

export function buildPlainAuthMessage(address: string, nonce: string, expiresAt: number): string {
  return [
    'Stacks Passkey Relay Login',
    `address=${address}`,
    `nonce=${nonce}`,
    `expires=${expiresAt}`,
  ].join('\n');
}

export function issueAuthChallengeForNetwork(address: string, network: RelayConfig['network']) {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  pendingChallenges.set(address, { nonce, expiresAt });
  return {
    nonce,
    expiresAt,
    plainMessage: buildPlainAuthMessage(address, nonce, expiresAt),
    domain: relayAuthDomain(network),
    message: buildAuthMessage(address, nonce, expiresAt),
  };
}

function hashPlainMessage(message: string): string[] {
  const bytes = utf8ToBytes(message);
  const hashes = [bytesToHex(sha256(bytes))];

  // Leather / SIWS plain signing uses \x17Stacks Signed Message:\n
  const siwsPrefix = '\x17Stacks Signed Message:\n';
  const siwsPrefixed = concatBytes(utf8ToBytes(siwsPrefix), utf8ToBytes(String(bytes.length)), bytes);
  hashes.push(bytesToHex(sha256(siwsPrefixed)));

  // Legacy alternate prefix (keep for compatibility)
  const legacyPrefix = '\x18Stacks Message Signing:\n';
  const legacyPrefixed = concatBytes(utf8ToBytes(legacyPrefix), utf8ToBytes(String(bytes.length)), bytes);
  hashes.push(bytesToHex(sha256(legacyPrefixed)));

  return hashes;
}

function verifyPlainSignature(opts: {
  address: string;
  signature: string;
  publicKey: string;
  message: string;
  network: RelayConfig['network'];
}): boolean {
  const sig = opts.signature.startsWith('0x') ? opts.signature.slice(2) : opts.signature;
  const networkName = opts.network === 'mainnet' ? 'mainnet' : 'testnet';
  for (const messageHash of hashPlainMessage(opts.message)) {
    try {
      const recovered = publicKeyFromSignatureRsv(messageHash, sig);
      const recoveredAddress = getAddressFromPublicKey(recovered, networkName);
      if (recoveredAddress !== opts.address) continue;
      const providedAddress = getAddressFromPublicKey(
        opts.publicKey.startsWith('0x') ? opts.publicKey.slice(2) : opts.publicKey,
        networkName
      );
      if (providedAddress === opts.address) return true;
    } catch {
      // try next hash format
    }
  }
  return false;
}

function verifyStructuredSignature(opts: {
  address: string;
  signature: string;
  publicKey: string;
  message: ReturnType<typeof buildAuthMessage>;
  domain: ReturnType<typeof relayAuthDomain>;
  network: RelayConfig['network'];
}): boolean {
  const structuredHash = bytesToHex(
    sha256(encodeStructuredDataBytes({ message: opts.message, domain: opts.domain }))
  );
  const sig = opts.signature.startsWith('0x') ? opts.signature.slice(2) : opts.signature;
  const recovered = publicKeyFromSignatureRsv(structuredHash, sig);
  const recoveredAddress = getAddressFromPublicKey(
    recovered,
    opts.network === 'mainnet' ? 'mainnet' : 'testnet'
  );
  if (recoveredAddress !== opts.address) return false;
  const providedAddress = getAddressFromPublicKey(
    opts.publicKey.startsWith('0x') ? opts.publicKey.slice(2) : opts.publicKey,
    opts.network === 'mainnet' ? 'mainnet' : 'testnet'
  );
  return providedAddress === opts.address;
}

export type AuthVerifyFailure =
  | 'missing_challenge'
  | 'nonce_mismatch'
  | 'expires_mismatch'
  | 'expired'
  | 'bad_signature';

export function verifyAuthSignatureWithReason(opts: {
  address: string;
  signature: string;
  publicKey: string;
  nonce: string;
  expiresAt: number;
  network: RelayConfig['network'];
  mode?: 'structured' | 'plain';
  plainMessage?: string;
}): { ok: true } | { ok: false; reason: AuthVerifyFailure } {
  const pending = pendingChallenges.get(opts.address);
  if (!pending) return { ok: false, reason: 'missing_challenge' };
  if (pending.nonce !== opts.nonce) return { ok: false, reason: 'nonce_mismatch' };
  if (pending.expiresAt !== opts.expiresAt) return { ok: false, reason: 'expires_mismatch' };
  if (Date.now() > pending.expiresAt) {
    pendingChallenges.delete(opts.address);
    return { ok: false, reason: 'expired' };
  }

  const mode = opts.mode ?? 'structured';
  let ok = false;
  if (mode === 'plain') {
    const message =
      opts.plainMessage ?? buildPlainAuthMessage(opts.address, opts.nonce, opts.expiresAt);
    ok = verifyPlainSignature({
      address: opts.address,
      signature: opts.signature,
      publicKey: opts.publicKey,
      message,
      network: opts.network,
    });
  } else {
    const domain = relayAuthDomain(opts.network);
    const message = buildAuthMessage(opts.address, opts.nonce, opts.expiresAt);
    ok = verifyStructuredSignature({
      address: opts.address,
      signature: opts.signature,
      publicKey: opts.publicKey,
      message,
      domain,
      network: opts.network,
    });
  }
  if (ok) {
    pendingChallenges.delete(opts.address);
    return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}

export function verifyAuthSignature(opts: {
  address: string;
  signature: string;
  publicKey: string;
  nonce: string;
  expiresAt: number;
  network: RelayConfig['network'];
  mode?: 'structured' | 'plain';
  plainMessage?: string;
}): boolean {
  return verifyAuthSignatureWithReason(opts).ok;
}

export function createWalletSession(
  address: string,
  sessionSecret: string
): { sessionToken: string; expiresAt: number } {
  const ttlMs = Number(process.env.RELAY_SESSION_TTL_MS ?? `${24 * 60 * 60 * 1000}`);
  const expiresAt = Date.now() + ttlMs;
  return {
    sessionToken: createSessionToken(address, sessionSecret, ttlMs),
    expiresAt,
  };
}

/** @internal test helper */
export function clearAuthChallenges(): void {
  pendingChallenges.clear();
}
