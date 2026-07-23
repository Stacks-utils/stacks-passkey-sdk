import { describe, expect, it } from 'vitest';
import {
  buildPlainAuthMessage,
  clearAuthChallenges,
  issueAuthChallengeForNetwork,
  verifyAuthSignature,
} from './wallet-auth.js';
import { privateKeyToAddress, privateKeyToPublic, signMessageHashRsv } from '@stacks/transactions';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, utf8ToBytes } from '@stacks/common';

describe('wallet-auth plain signatures', () => {
  it('accepts SIWS-style plain message signatures (Leather stx_signMessage)', () => {
    clearAuthChallenges();
    const privateKey = 'f5a31c1268a1e37d4edaa05c7d11183c5fbfdcdc48aae36ea4d8cd5cb709932801';
    const publicKey = privateKeyToPublic(privateKey);
    const address = privateKeyToAddress(privateKey, 'testnet');
    const { nonce, expiresAt } = issueAuthChallengeForNetwork(address, 'testnet');
    const plainMessage = buildPlainAuthMessage(address, nonce, expiresAt);

    const bytes = utf8ToBytes(plainMessage);
    const prefixed = concatBytes(
      utf8ToBytes('\x17Stacks Signed Message:\n'),
      utf8ToBytes(String(bytes.length)),
      bytes
    );
    const messageHash = bytesToHex(sha256(prefixed));
    const signature = signMessageHashRsv({ messageHash, privateKey });

    const ok = verifyAuthSignature({
      address,
      signature,
      publicKey,
      nonce,
      expiresAt,
      network: 'testnet',
      mode: 'plain',
      plainMessage,
    });

    expect(ok).toBe(true);
  });
});
