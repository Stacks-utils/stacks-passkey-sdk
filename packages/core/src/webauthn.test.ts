import { describe, expect, it } from 'vitest';
import { encode } from 'cbor-x';
import { p256 } from '@noble/curves/p256';
import { createTestPasskey } from './webauthn-crypto.js';
import { extractCosePublicKey } from './webauthn.js';

function bstr(bytes: Uint8Array): number[] {
  const len = bytes.length;
  if (len < 24) return [0x40 + len, ...bytes];
  return [0x58, len, ...bytes];
}

function buildCoseKeyBytes(x: Uint8Array, y: Uint8Array): Uint8Array {
  return new Uint8Array([
    0xa5,
    0x01,
    0x02,
    0x03,
    0x26,
    0x20,
    0x01,
    0x21,
    ...bstr(x),
    0x22,
    ...bstr(y),
  ]);
}

describe('signWithPasskey response parsing', () => {
  it('reads clientDataJSON from ArrayBuffer responses', () => {
    const json = JSON.stringify({
      type: 'webauthn.get',
      challenge: 'abc',
      origin: 'http://localhost:3000',
      crossOrigin: false,
    });
    const bytes = new TextEncoder().encode(json);
    const fromBuffer = new Uint8Array(bytes.buffer);
    expect(new TextDecoder().decode(fromBuffer)).toBe(json);
    expect(String(bytes.buffer)).not.toBe(json);
  });
});

describe('extractCosePublicKey', () => {
  it('reads x/y from WebAuthn COSE keys decoded as plain objects', () => {
    const passkey = createTestPasskey();
    const publicKeyPoint = p256.getPublicKey(passkey.privateKey, false);
    const x = publicKeyPoint.slice(1, 33);
    const y = publicKeyPoint.slice(33, 65);

    const credentialId = new Uint8Array([1, 2, 3]);
    const coseKeyBytes = buildCoseKeyBytes(x, y);
    const authData = new Uint8Array(37 + 16 + 2 + credentialId.length + coseKeyBytes.length);
    authData.set(new Uint8Array(32), 0);
    authData[32] = 0x45;
    authData.set(new Uint8Array(16).fill(0xaa), 37);
    authData[54] = credentialId.length;
    authData.set(credentialId, 55);
    authData.set(coseKeyBytes, 55 + credentialId.length);

    const attestationObject = encode({
      fmt: 'none',
      attStmt: {},
      authData,
    });

    expect(extractCosePublicKey(attestationObject)).toEqual(passkey.publicKey);
  });
});
