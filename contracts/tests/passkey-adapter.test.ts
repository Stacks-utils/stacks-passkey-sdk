import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey, signWebAuthn, cvToBytes } from './helpers/webauthn.js';

const deployer = simnet.deployer;
const wallet2 = simnet.getAccounts().get('wallet_2')!;
const mockApp = `${deployer}.mock-passkey-app`;

function invokeHashArgs(
  target: string,
  functionName: string,
  arg0: bigint,
  user: string
) {
  return [
    Cl.principal(target),
    Cl.stringAscii(functionName),
    Cl.uint(arg0),
    Cl.uint(0),
    Cl.principal(user),
    Cl.principal('ST000000000000000000002AMW42H'),
    Cl.buffer(new Uint8Array(1024)),
  ];
}

function invokeExecArgs(
  passkey: ReturnType<typeof createTestPasskey>,
  targetAddress: string,
  targetName: string,
  functionName: string,
  arg0: bigint,
  user: string,
  assertion: ReturnType<typeof signWebAuthn>
) {
  return [
    Cl.contractPrincipal(targetAddress, targetName),
    Cl.stringAscii(functionName),
    Cl.uint(arg0),
    Cl.uint(0),
    Cl.principal(user),
    Cl.principal('ST000000000000000000002AMW42H'),
    Cl.buffer(new Uint8Array(1024)),
    Cl.buffer(passkey.publicKey),
    Cl.buffer(assertion.signature),
    Cl.buffer(assertion.authenticatorData),
    Cl.buffer(assertion.clientDataJSON),
  ];
}

describe('passkey-adapter + invoke flow', () => {
  beforeEach(() => {
    simnet.callPublicFn('passkey-adapter', 'register-contract', [Cl.principal(mockApp)], deployer);
  });

  it('registers demo app contract', () => {
    const { result } = simnet.callReadOnlyFn(
      'passkey-adapter',
      'is-registered',
      [Cl.principal(mockApp)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it('invokes set-score via execute-via-adapter', () => {
    const passkey = createTestPasskey();
    simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );

    const user = wallet2;
    const score = 42n;
    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-invoke-hash',
      invokeHashArgs(mockApp, 'set-score', score, user),
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'execute-via-adapter',
      invokeExecArgs(passkey, deployer, 'mock-passkey-app', 'set-score', score, user, assertion),
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: scoreResult } = simnet.callReadOnlyFn(
      'mock-passkey-app',
      'get-score',
      [Cl.principal(user)],
      deployer
    );
    expect(scoreResult).toBeOk(Cl.uint(42));
  });

  it('invokes set-score with relay fee reimbursement from contract balance', () => {
    const passkey = createTestPasskey();
    const contractId = `${deployer}.passkey-account`;
    simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    simnet.transferSTX(50_000, contractId, deployer);

    const user = wallet2;
    const score = 42n;
    const feeRecipient = wallet2;
    const feeAmount = 500n;
    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-invoke-with-fee-hash',
      [
        ...invokeHashArgs(mockApp, 'set-score', score, user),
        Cl.principal(feeRecipient),
        Cl.uint(feeAmount),
      ],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const feeBefore = simnet.getAssetsMap().get('STX')?.get(feeRecipient) ?? 0n;
    const execArgs = invokeExecArgs(
      passkey,
      deployer,
      'mock-passkey-app',
      'set-score',
      score,
      user,
      assertion
    );
    const webAuthnArgs = execArgs.slice(-4);
    const invokeArgs = execArgs.slice(0, -4);
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'execute-via-adapter-with-fee',
      [
        ...invokeArgs,
        Cl.principal(feeRecipient),
        Cl.uint(feeAmount),
        ...webAuthnArgs,
      ],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const feeAfter = simnet.getAssetsMap().get('STX')?.get(feeRecipient) ?? 0n;
    expect(feeAfter - feeBefore).toBe(feeAmount);
  });
});
