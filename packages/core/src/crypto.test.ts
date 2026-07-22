import { describe, expect, it } from 'vitest';
import {
  createTestPasskey,
  signWebAuthnAssertion,
  computeWebAuthnSignedHash,
  buildAuthenticatorData,
  buildClientDataJSON,
  derToRS,
  normalizeLowS,
  compressP256,
  base64UrlEncode,
  base64UrlDecode,
} from '../src/index.js';
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { rsToDer } from '../src/webauthn-crypto.js';

describe('crypto utilities', () => {
  it('round-trips base64url encoding', () => {
    const data = new Uint8Array([1, 2, 3, 250, 255]);
    expect(base64UrlDecode(base64UrlEncode(data))).toEqual(data);
  });

  it('compresses P-256 public keys', () => {
    const passkey = createTestPasskey();
    expect(passkey.publicKey.length).toBe(33);
    expect(passkey.publicKey[0] === 0x02 || passkey.publicKey[0] === 0x03).toBe(true);
  });

  it('normalizes signatures to low-s form', () => {
    const passkey = createTestPasskey();
    const hash = sha256(new TextEncoder().encode('test'));
    const sig = p256.sign(hash, passkey.privateKey).toCompactRawBytes();
    const normalized = normalizeLowS(sig);
    expect(normalized.length).toBe(64);
  });

  it('converts DER signatures to compact r||s', () => {
    const passkey = createTestPasskey();
    const hash = sha256(new TextEncoder().encode('der-test'));
    const compact = p256.sign(hash, passkey.privateKey).toCompactRawBytes();
    const der = rsToDer(compact);
    const recovered = derToRS(der);
    expect(recovered).toEqual(compact);
  });
});

describe('webauthn assertion flow', () => {
  it('produces verifiable signed hash', () => {
    const passkey = createTestPasskey();
    const challenge = sha256(new TextEncoder().encode('action'));
    const assertion = signWebAuthnAssertion(passkey, challenge, 'localhost', 'http://localhost', 1);

    const signedHash = computeWebAuthnSignedHash(assertion.authenticatorData, assertion.clientDataJSON);
    expect(p256.verify(assertion.signature, signedHash, passkey.publicKey)).toBe(true);
  });

  it('increments sign count in authenticator data', () => {
    const rpIdHash = sha256(new TextEncoder().encode('localhost'));
    const auth1 = buildAuthenticatorData(rpIdHash, 1);
    const auth2 = buildAuthenticatorData(rpIdHash, 2);
    expect(auth1[36]).toBe(1);
    expect(auth2[36]).toBe(2);
  });

  it('embeds challenge in clientDataJSON', () => {
    const challenge = sha256(new TextEncoder().encode('challenge'));
    const clientData = buildClientDataJSON(challenge, 'http://localhost');
    const json = JSON.parse(new TextDecoder().decode(clientData));
    expect(json.challenge).toBe(base64UrlEncode(challenge));
    expect(json.type).toBe('webauthn.get');
  });
});
