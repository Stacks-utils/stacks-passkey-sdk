import { bytesToHex, hexToBytes } from '@stacks/common';

const P256_N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
const P256_HALF_N = P256_N / 2n;

export function derToRS(der: Uint8Array): Uint8Array {
  let offset = 2;
  if (der[1] & 0x80) {
    offset += der[1] & 0x7f;
  }
  offset += 1;
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  offset += 1;
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  const rs = new Uint8Array(64);
  rs.set(r.slice(Math.max(0, r.length - 32)), 32 - Math.min(32, r.length));
  rs.set(s.slice(Math.max(0, s.length - 32)), 64 - Math.min(32, s.length));
  return rs;
}

export function normalizeLowS(sig: Uint8Array): Uint8Array {
  const s = BigInt(`0x${bytesToHex(sig.slice(32))}`);
  if (s <= P256_HALF_N) return sig;
  const lowS = P256_N - s;
  const out = new Uint8Array(sig);
  const hex = lowS.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    out[32 + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(data: string): Uint8Array {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function bufferToHex(data: Uint8Array): string {
  return bytesToHex(data);
}

export function hexToBuffer(hex: string): Uint8Array {
  return hexToBytes(hex.startsWith('0x') ? hex.slice(2) : hex);
}

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
