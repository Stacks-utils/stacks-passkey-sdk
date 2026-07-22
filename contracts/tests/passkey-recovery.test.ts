import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const guardian1 = accounts.get('wallet_1')!;
const guardian2 = accounts.get('wallet_2')!;

describe('passkey-recovery', () => {
  it('adds guardians and initiates recovery', () => {
    simnet.callPublicFn('passkey-recovery', 'add-guardian', [Cl.principal(guardian1)], deployer);
    simnet.callPublicFn('passkey-recovery', 'add-guardian', [Cl.principal(guardian2)], deployer);

    const { result: isGuardian } = simnet.callReadOnlyFn(
      'passkey-recovery',
      'is-guardian',
      [Cl.principal(guardian1)],
      deployer
    );
    expect(isGuardian).toBeOk(Cl.bool(true));

    const newPubkey = Cl.bufferFromHex(
      '03adb8de4bfb65db2cfd6120d55c6526ae9c52e675db7e47308636534ba778611'
    );

    const { result: initiate } = simnet.callPublicFn(
      'passkey-recovery',
      'initiate-recovery',
      [newPubkey],
      guardian1
    );
    expect(initiate).toBeOk(Cl.bool(true));

    const { result: status } = simnet.callReadOnlyFn(
      'passkey-recovery',
      'get-recovery-status',
      [],
      deployer
    );
    expect(status).toBeOk(
      Cl.tuple({
        pending: Cl.bool(true),
        delay: Cl.uint(144),
        pubkey: Cl.some(
          Cl.bufferFromHex('03adb8de4bfb65db2cfd6120d55c6526ae9c52e675db7e47308636534ba778611')
        ),
        'start-block': Cl.some(Cl.uint(2)),
      })
    );
  });

  it('allows owner to cancel recovery', () => {
    const newPubkey = Cl.bufferFromHex(
      '03adb8de4bfb65db2cfd6120d55c6526ae9c52e675db7e47308636534ba778611'
    );

    simnet.callPublicFn('passkey-recovery', 'add-guardian', [Cl.principal(guardian1)], deployer);
    simnet.callPublicFn('passkey-recovery', 'initiate-recovery', [newPubkey], guardian1);

    const { result } = simnet.callPublicFn('passkey-recovery', 'cancel-recovery', [], deployer);
    expect(result).toBeOk(Cl.bool(true));

    const { result: status } = simnet.callReadOnlyFn(
      'passkey-recovery',
      'get-recovery-status',
      [],
      deployer
    );
    expect(status).toBeOk(
      Cl.tuple({
        pending: Cl.bool(false),
        delay: Cl.uint(144),
        pubkey: Cl.none(),
        'start-block': Cl.none(),
      })
    );
  });

  it('enforces timelock before completing recovery', () => {
    const newPubkey = Cl.bufferFromHex(
      '03adb8de4bfb65db2cfd6120d55c6526ae9c52e675db7e47308636534ba778611'
    );

    simnet.callPublicFn('passkey-recovery', 'add-guardian', [Cl.principal(guardian1)], deployer);
    simnet.callPublicFn('passkey-recovery', 'initiate-recovery', [newPubkey], guardian1);

    const { result: tooEarly } = simnet.callPublicFn(
      'passkey-recovery',
      'complete-recovery',
      [],
      guardian1
    );
    expect(tooEarly).toBeErr(Cl.uint(2006));

    simnet.mineEmptyBlocks(150);

    const { result: completed } = simnet.callPublicFn(
      'passkey-recovery',
      'complete-recovery',
      [],
      guardian1
    );
    expect(completed).toBeOk(newPubkey);
  });
});
