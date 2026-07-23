import { describe, it, expect, afterEach } from 'vitest';
import { isContractAllowed } from './rate-limit.js';

describe('isContractAllowed', () => {
  const policy = {
    allowedContracts: ['ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ'],
    maxFeeMicroStx: 50_000n,
    rateLimit: { windowMs: 60_000, maxRequests: 100 },
  };

  afterEach(() => {
    delete process.env.PASSKEY_SMART_ACCOUNT_NAME;
  });

  it('allows platform deployer contracts', () => {
    expect(isContractAllowed('ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter', policy)).toBe(true);
  });

  it('allows self-deployed smart-account contracts on any origin address', () => {
    expect(isContractAllowed('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG.smart-account', policy)).toBe(true);
  });

  it('rejects unrelated contracts', () => {
    expect(isContractAllowed('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG.other-contract', policy)).toBe(false);
  });
});
