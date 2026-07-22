import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey, signWebAuthn, hexToBytes } from './helpers/webauthn.js';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

describe('webauthn-verifier', () => {
  it('verifies a valid WebAuthn signature', () => {
    const passkey = createTestPasskey();
    const challenge = hexToBytes('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20');
    const { signature, authenticatorData, clientDataJSON } = signWebAuthn(
      passkey.privateKey,
      challenge
    );

    const { result } = simnet.callReadOnlyFn(
      'webauthn-verifier',
      'verify-webauthn-signature',
      [
        Cl.buffer(signature),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(authenticatorData),
        Cl.buffer(clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it('rejects an invalid signature', () => {
    const passkey = createTestPasskey();
    const challenge = hexToBytes('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20');
    const { signature, authenticatorData, clientDataJSON } = signWebAuthn(
      passkey.privateKey,
      challenge
    );
    const badSig = new Uint8Array(signature);
    badSig[0] ^= 0xff;

    const { result } = simnet.callReadOnlyFn(
      'webauthn-verifier',
      'verify-webauthn-signature',
      [
        Cl.buffer(badSig),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(authenticatorData),
        Cl.buffer(clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeErr(Cl.uint(6001));
  });
});
