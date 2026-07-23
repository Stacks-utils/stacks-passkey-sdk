import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';
import { createTestPasskey } from './helpers/webauthn.js';

const deployer = simnet.deployer;
const userAccount = `${deployer}.passkey-acc-user1`;

describe('passkey-factory', () => {
  let passkey: ReturnType<typeof createTestPasskey>;

  beforeEach(() => {
    passkey = createTestPasskey();
    simnet.callPublicFn(
      'passkey-acc-user1',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    simnet.callPublicFn(
      'passkey-factory',
      'register-account',
      [Cl.buffer(passkey.publicKey), Cl.contractPrincipal(deployer, 'passkey-acc-user1')],
      deployer
    );
  });

  it('registers pubkey to account mapping', () => {
    const { result } = simnet.callReadOnlyFn(
      'passkey-factory',
      'lookup-account',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    expect(result).toBeOk(Cl.some(Cl.principal(userAccount)));
  });

  it('rejects duplicate factory registration', () => {
    const other = createTestPasskey();
    const { result } = simnet.callPublicFn(
      'passkey-factory',
      'register-account',
      [Cl.buffer(passkey.publicKey), Cl.contractPrincipal(deployer, 'passkey-account')],
      deployer
    );
    expect(result).toBeErr(Cl.uint(3002));
    expect(other.publicKey).toBeDefined();
  });
});
