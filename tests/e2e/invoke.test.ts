import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey, signWebAuthn, cvToBytes } from '../../contracts/tests/helpers/webauthn.js';

const deployer = simnet.deployer;
const wallet2 = simnet.getAccounts().get('wallet_2')!;
const mockApp = `${deployer}.mock-passkey-app`;

describe('passkey invoke e2e', () => {
  beforeEach(() => {
    simnet.callPublicFn('passkey-adapter', 'register-contract', [Cl.principal(mockApp)], deployer);
  });

  it('invokes set-score through adapter', () => {
    const passkey = createTestPasskey();
    simnet.callPublicFn('passkey-account', 'register', [Cl.buffer(passkey.publicKey)], deployer);

    const user = wallet2;
    const score = 77n;
    const hashArgs = [
      Cl.principal(mockApp),
      Cl.stringAscii('set-score'),
      Cl.uint(score),
      Cl.uint(0),
      Cl.principal(user),
      Cl.principal('ST000000000000000000002AMW42H'),
      Cl.buffer(new Uint8Array(1024)),
    ];
    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-invoke-hash',
      hashArgs,
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'execute-via-adapter',
      [
        Cl.contractPrincipal(deployer, 'mock-passkey-app'),
        Cl.stringAscii('set-score'),
        Cl.uint(score),
        Cl.uint(0),
        Cl.principal(user),
        Cl.principal('ST000000000000000000002AMW42H'),
        Cl.buffer(new Uint8Array(1024)),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it('supports built-in transfer-stx', () => {
    const passkey = createTestPasskey();
    simnet.callPublicFn('passkey-account', 'register', [Cl.buffer(passkey.publicKey)], deployer);
    simnet.transferSTX(50_000, `${deployer}.passkey-account`, deployer);

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-hash',
      [Cl.principal(wallet2), Cl.uint(1500)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'transfer-stx',
      [
        Cl.principal(wallet2),
        Cl.uint(1500),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });
});
