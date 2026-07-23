import { describe, it, expect } from 'vitest';
import {
  buildContractCallArgs,
  buildExecuteFunctionArgs,
  createInvokeAction,
  getExecuteFunctionName,
} from './actions.js';
import { Cl, cvToValue } from '@stacks/transactions';

describe('invoke actions', () => {
  it('parses action hash from cvToValue-wrapped (ok buff) read-only response', () => {
    const hash = new Uint8Array(32).fill(0xab);
    const wrapped = cvToValue(Cl.ok(Cl.buffer(hash)));
    expect(wrapped).toEqual({ type: '(buff 32)', value: `0x${Buffer.from(hash).toString('hex')}` });
  });

  it('parses bool from cvToValue-wrapped (ok bool) read-only response', () => {
    expect(cvToValue(Cl.ok(Cl.bool(true)))).toEqual({ type: 'bool', value: true });
    expect(cvToValue(Cl.ok(Cl.bool(false)))).toEqual({ type: 'bool', value: false });
  });

  it('normalizes optional args with defaults', () => {
    const args = buildContractCallArgs({});
    expect(args).toHaveLength(5);
  });

  it('builds execute function name for invoke', () => {
    const action = createInvokeAction('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-app', 'set-score');
    expect(getExecuteFunctionName(action)).toBe('execute-via-adapter');
  });

  it('builds Clarity args for execute-via-adapter', () => {
    const action = createInvokeAction('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-app', 'set-score', {
      arg0: 10n,
      arg2: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    });
    const args = buildExecuteFunctionArgs(
      action,
      new Uint8Array(33).fill(1),
      new Uint8Array(64).fill(2),
      new Uint8Array(37).fill(3),
      new Uint8Array(100).fill(4)
    );
    expect(args[0]).toEqual(Cl.contractPrincipal('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', 'my-app'));
    expect(args[1]).toEqual(Cl.stringAscii('set-score'));
  });
});
