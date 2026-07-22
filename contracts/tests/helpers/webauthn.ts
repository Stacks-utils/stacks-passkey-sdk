import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function compressP256(x: Uint8Array, y: Uint8Array): Uint8Array {
  const prefix = y[y.length - 1] & 1 ? 0x03 : 0x02;
  const out = new Uint8Array(33);
  out[0] = prefix;
  out.set(x, 1);
  return out;
}

export function base64UrlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString('base64url');
}

export function createTestPasskey() {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKeyPoint = p256.getPublicKey(privateKey, false);
  const x = publicKeyPoint.slice(1, 33);
  const y = publicKeyPoint.slice(33, 65);
  return { privateKey, publicKey: compressP256(x, y) };
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

export function buildClientDataJSON(challenge: Uint8Array, origin = 'http://localhost'): Uint8Array {
  const json = JSON.stringify({
    type: 'webauthn.get',
    challenge: base64UrlEncode(challenge),
    origin,
    crossOrigin: false,
  });
  return new TextEncoder().encode(json);
}

export function signWebAuthn(
  privateKey: Uint8Array,
  challenge: Uint8Array,
  rpId = 'localhost',
  signCount = 1
) {
  const rpIdHash = sha256(new TextEncoder().encode(rpId));
  const authenticatorData = buildAuthenticatorData(rpIdHash, signCount);
  const clientDataJSON = buildClientDataJSON(challenge);
  const clientDataHash = sha256(clientDataJSON);
  const signedHash = sha256(concatBytes(authenticatorData, clientDataHash));
  const sig = p256.sign(signedHash, privateKey);
  return {
    signature: sig.toCompactRawBytes(),
    authenticatorData,
    clientDataJSON,
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function cvToBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return hexToBytes(value);
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return cvToBytes((value as { value: unknown }).value);
  }
  throw new Error(`Cannot convert clarity value: ${String(value)}`);
}
