import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { concatBytes, base64UrlEncode, compressP256, normalizeLowS } from './crypto.js';
import type { WebAuthnAssertion } from './types.js';

export interface TestPasskey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  credentialId: string;
}

export function createTestPasskey(): TestPasskey {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKeyPoint = p256.getPublicKey(privateKey, false);
  const x = publicKeyPoint.slice(1, 33);
  const y = publicKeyPoint.slice(33, 65);
  const publicKey = compressP256(x, y);
  const credentialId = base64UrlEncode(sha256(publicKey));
  return { privateKey, publicKey, credentialId };
}

export function buildAuthenticatorData(rpIdHash: Uint8Array, signCount: number, flags = 0x05): Uint8Array {
  const authData = new Uint8Array(37);
  authData.set(rpIdHash, 0);
  authData[32] = flags;
  authData[33] = (signCount >> 24) & 0xff;
  authData[34] = (signCount >> 16) & 0xff;
  authData[35] = (signCount >> 8) & 0xff;
  authData[36] = signCount & 0xff;
  return authData;
}

export function buildClientDataJSON(challenge: Uint8Array, origin: string, type: 'webauthn.get' | 'webauthn.create' = 'webauthn.get'): Uint8Array {
  const json = JSON.stringify({
    type,
    challenge: base64UrlEncode(challenge),
    origin,
    crossOrigin: false,
  });
  return new TextEncoder().encode(json);
}

export function computeWebAuthnSignedHash(authenticatorData: Uint8Array, clientDataJSON: Uint8Array): Uint8Array {
  const clientDataHash = sha256(clientDataJSON);
  return sha256(concatBytes(authenticatorData, clientDataHash));
}

export function signWebAuthnAssertion(
  passkey: TestPasskey,
  challenge: Uint8Array,
  rpId: string,
  origin: string,
  signCount = 1
): WebAuthnAssertion {
  const rpIdHash = sha256(new TextEncoder().encode(rpId));
  const authenticatorData = buildAuthenticatorData(rpIdHash, signCount);
  const clientDataJSON = buildClientDataJSON(challenge, origin);
  const signedHash = computeWebAuthnSignedHash(authenticatorData, clientDataJSON);

  const sig = p256.sign(signedHash, passkey.privateKey);
  const signature = normalizeLowS(sig.toCompactRawBytes());

  return { signature, authenticatorData, clientDataJSON };
}

export function rsToDer(signature: Uint8Array): Uint8Array {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);

  function encodeInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let intBytes: Uint8Array = bytes.slice(start);
    if (intBytes[0] & 0x80) {
      intBytes = Uint8Array.from([0, ...intBytes]);
    }
    const header = new Uint8Array([0x02, intBytes.length]);
    return concatBytes(header, intBytes);
  }

  const rEnc = encodeInteger(r);
  const sEnc = encodeInteger(s);
  const seqContent = concatBytes(rEnc, sEnc);
  const seqHeader = new Uint8Array([0x30, seqContent.length]);
  return concatBytes(seqHeader, seqContent);
}
