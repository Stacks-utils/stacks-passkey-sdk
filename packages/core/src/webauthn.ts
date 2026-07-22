import { decode } from 'cbor-x';
import { sha256 } from '@noble/hashes/sha2';
import { compressP256, derToRS, normalizeLowS, base64UrlDecode, base64UrlEncode } from './crypto.js';
import type { PasskeyConfig, WebAuthnAssertion } from './types.js';

function getCoseKeyBytes(coseKey: unknown, key: number): Uint8Array {
  if (coseKey instanceof Map) {
    const value = coseKey.get(key);
    if (value instanceof Uint8Array) return value;
  } else if (typeof coseKey === 'object' && coseKey !== null) {
    const record = coseKey as Record<string | number, unknown>;
    const value = record[key] ?? record[String(key)];
    if (value instanceof Uint8Array) return value;
  }
  throw new Error(`Missing COSE key field ${key}`);
}

export function extractCosePublicKey(attestationObject: ArrayBuffer | Uint8Array): Uint8Array {
  const attestationBytes = attestationObject instanceof Uint8Array
    ? attestationObject
    : new Uint8Array(attestationObject);
  const attestation = decode(attestationBytes) as {
    authData: Uint8Array;
  };
  const authData = attestation.authData;
  const flags = authData[32];
  const hasAttestedCredential = (flags & 0x40) !== 0;
  if (!hasAttestedCredential) {
    throw new Error('Missing attested credential data in WebAuthn response');
  }

  let offset = 37;
  offset += 16;
  const credIdLen = (authData[offset] << 8) | authData[offset + 1];
  offset += 2 + credIdLen;

  const coseKey = decode(authData.slice(offset));
  const x = getCoseKeyBytes(coseKey, -2);
  const y = getCoseKeyBytes(coseKey, -3);
  return compressP256(x, y);
}

export async function registerPasskey(config: PasskeyConfig, userId: string, userName: string) {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is not available in this environment');
  }

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: config.rpName, id: config.rpId },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey registration was cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = extractCosePublicKey(response.attestationObject);

  return {
    credentialId: base64UrlEncode(new Uint8Array(credential.rawId)),
    publicKey,
    rawCredential: credential,
  };
}

export async function authenticatePasskey(
  config: PasskeyConfig,
  allowCredentials: PublicKeyCredentialDescriptor[] = []
): Promise<{ credentialId: string }> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is not available in this environment');
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: config.rpId,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey sign-in was cancelled');

  return {
    credentialId: base64UrlEncode(new Uint8Array(credential.rawId)),
  };
}

export async function signWithPasskey(
  config: PasskeyConfig,
  credentialId: string,
  challenge: Uint8Array
): Promise<WebAuthnAssertion> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is not available in this environment');
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(challenge) as BufferSource,
      rpId: config.rpId,
      allowCredentials: [
        {
          id: new Uint8Array(base64UrlDecode(credentialId)) as BufferSource,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey signing was cancelled');

  const response = assertion.response as AuthenticatorAssertionResponse;
  const signature = normalizeLowS(derToRS(new Uint8Array(response.signature)));

  return {
    signature,
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}

export function verifyChallengeInClientData(clientDataJSON: Uint8Array, expectedChallenge: Uint8Array): boolean {
  const json = JSON.parse(new TextDecoder().decode(clientDataJSON)) as { challenge?: string };
  if (!json.challenge) return false;
  const decoded = base64UrlDecode(json.challenge);
  if (decoded.length !== expectedChallenge.length) return false;
  return decoded.every((b, i) => b === expectedChallenge[i]);
}

export function computeRpIdHash(rpId: string): Uint8Array {
  return sha256(new TextEncoder().encode(rpId));
}
