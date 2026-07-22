import { describe, expect, it, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey, signWebAuthn, cvToBytes } from './helpers/webauthn.js';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet2 = accounts.get('wallet_2')!;
const contractId = `${deployer}.passkey-account`;

describe('passkey-account', () => {
  let passkey: ReturnType<typeof createTestPasskey>;

  beforeEach(() => {
    passkey = createTestPasskey();
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    simnet.transferSTX(50_000, contractId, deployer);
  });

  it('registers a passkey public key', () => {
    const { result } = simnet.callReadOnlyFn(
      'passkey-account',
      'is-key-authorized',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it('rejects duplicate registration', () => {
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(1005));
  });

  it('transfers STX with a valid passkey signature', () => {
    const recipient = wallet2;
    const amount = 1000n;

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-hash',
      [Cl.principal(recipient), Cl.uint(amount)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);

    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);
    const balanceBefore = simnet.getAssetsMap().get('STX')?.get(recipient) ?? 0n;

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'transfer-stx',
      [
        Cl.principal(recipient),
        Cl.uint(amount),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));
    const balanceAfter = simnet.getAssetsMap().get('STX')?.get(recipient) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(amount);
  });

  it('transfers STX with a counterless passkey signature (sign count 0)', () => {
    const recipient = wallet2;
    const amount = 500n;

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-hash',
      [Cl.principal(recipient), Cl.uint(amount)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 0);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'transfer-stx',
      [
        Cl.principal(recipient),
        Cl.uint(amount),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it('adds a second device key with passkey authorization', () => {
    const secondPasskey = createTestPasskey();

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-add-key-hash',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'add-key',
      [
        Cl.buffer(secondPasskey.publicKey),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const { result: authorized } = simnet.callReadOnlyFn(
      'passkey-account',
      'is-key-authorized',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    expect(authorized).toBeOk(Cl.bool(true));
  });

  it('removes a device key when more than one exists', () => {
    const secondPasskey = createTestPasskey();

    const addHashResult = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-add-key-hash',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    const addHash = cvToBytes(addHashResult.result.value);
    const addAssertion = signWebAuthn(passkey.privateKey, addHash, 'localhost', 1);

    simnet.callPublicFn(
      'passkey-account',
      'add-key',
      [
        Cl.buffer(secondPasskey.publicKey),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(addAssertion.signature),
        Cl.buffer(addAssertion.authenticatorData),
        Cl.buffer(addAssertion.clientDataJSON),
      ],
      deployer
    );

    const removeHashResult = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-remove-key-hash',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    const removeHash = cvToBytes(removeHashResult.result.value);
    const removeAssertion = signWebAuthn(passkey.privateKey, removeHash, 'localhost', 2);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'remove-key',
      [
        Cl.buffer(secondPasskey.publicKey),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(removeAssertion.signature),
        Cl.buffer(removeAssertion.authenticatorData),
        Cl.buffer(removeAssertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const { result: authorized } = simnet.callReadOnlyFn(
      'passkey-account',
      'is-key-authorized',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    expect(authorized).toBeOk(Cl.bool(false));
  });

  it('rejects replayed signatures', () => {
    const recipient = wallet2;
    const amount = 500n;

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-hash',
      [Cl.principal(recipient), Cl.uint(amount)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const args = [
      Cl.principal(recipient),
      Cl.uint(amount),
      Cl.buffer(passkey.publicKey),
      Cl.buffer(assertion.signature),
      Cl.buffer(assertion.authenticatorData),
      Cl.buffer(assertion.clientDataJSON),
    ];

    const first = simnet.callPublicFn('passkey-account', 'transfer-stx', args, deployer);
    expect(first.result).toBeOk(Cl.bool(true));

    const second = simnet.callPublicFn('passkey-account', 'transfer-stx', args, deployer);
    expect(second.result).toBeErr(Cl.uint(1007));
  });

  it('allows a second user to register a different passkey', () => {
    const secondPasskey = createTestPasskey();
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(secondPasskey.publicKey)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it('transfers STX with fee reimbursement from contract balance', () => {
    const feeRecipient = wallet2;
    const recipient = deployer;
    const amount = 1000n;
    const feeAmount = 500n;

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-with-fee-hash',
      [Cl.principal(recipient), Cl.uint(amount), Cl.principal(feeRecipient), Cl.uint(feeAmount)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const feeBefore = simnet.getAssetsMap().get('STX')?.get(feeRecipient) ?? 0n;
    const { result } = simnet.callPublicFn(
      'passkey-account',
      'transfer-stx-with-fee',
      [
        Cl.principal(recipient),
        Cl.uint(amount),
        Cl.principal(feeRecipient),
        Cl.uint(feeAmount),
        Cl.buffer(passkey.publicKey),
        Cl.buffer(assertion.signature),
        Cl.buffer(assertion.authenticatorData),
        Cl.buffer(assertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));
    const feeAfter = simnet.getAssetsMap().get('STX')?.get(feeRecipient) ?? 0n;
    expect(feeAfter - feeBefore).toBe(feeAmount);
  });
});
