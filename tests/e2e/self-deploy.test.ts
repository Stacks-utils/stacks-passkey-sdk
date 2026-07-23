import { describe, it, expect } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey, signWebAuthn, cvToBytes } from '../../contracts/tests/helpers/webauthn.js';

const deployer = simnet.deployer;
const wallet2 = simnet.getAccounts().get('wallet_2')!;
/** Simnet deploys smart-account under deployer; on testnet it would be STorigin.smart-account. */
const origin = deployer;
const smartAccountContract = `${origin}.smart-account`;

describe('self-deploy smart account e2e', () => {
  it('transfers STX from STorigin.smart-account', () => {
    const passkey = createTestPasskey();

    simnet.callPublicFn('smart-account', 'register', [Cl.buffer(passkey.publicKey)], origin);
    simnet.callPublicFn(
      'passkey-factory',
      'register-account',
      [Cl.buffer(passkey.publicKey), Cl.contractPrincipal(origin, 'smart-account')],
      deployer
    );
    simnet.transferSTX(100_000, smartAccountContract, deployer);

    const { result: hashResult } = simnet.callReadOnlyFn(
      'smart-account',
      'compute-transfer-hash',
      [Cl.principal(wallet2), Cl.uint(2500)],
      origin
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const balanceBefore = simnet.getAssetsMap().get('STX')?.get(wallet2) ?? 0n;
    const { result } = simnet.callPublicFn(
      'smart-account',
      'transfer-stx',
      [
        Cl.principal(wallet2),
        Cl.uint(2500),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      origin
    );
    expect(result).toBeOk(Cl.bool(true));
    const balanceAfter = simnet.getAssetsMap().get('STX')?.get(wallet2) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(2500n);
  });
});
