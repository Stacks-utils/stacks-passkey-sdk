import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountService, DEFAULT_SELF_DEPLOY_ACCOUNT_NAME } from './account-service.js';
import { AccountStore } from './accounts.js';
import type { RelayConfig } from './types.js';

describe('AccountService', () => {
  let dir: string;
  let service: AccountService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'account-service-'));
    process.env.PASSKEY_ADAPTER_ADDRESS = 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ';
    process.env.PASSKEY_ADAPTER_NAME = 'passkey-adapter';
    const clarPath = join(dir, 'passkey-account.clar');
    writeFileSync(
      clarPath,
      `(use-trait exec-trait .passkey-adapter.passkey-exec-trait)
(contract-call? .passkey-adapter forward-invoke target)
`
    );
    process.env.PASSKEY_ACCOUNT_CONTRACT_PATH = clarPath;

    const config: RelayConfig = {
      sponsorPrivateKey: '753b7cc01a1855527860d90776314512f5f16cc592133f14327856e06653810e01',
      masterSecret: 'test-master',
      sessionSecret: 'test-session',
      network: 'testnet',
      port: 8787,
      host: '127.0.0.1',
      policy: { maxFeeMicroStx: 50_000n, rateLimit: { windowMs: 60_000, maxRequests: 100 } },
    };
    service = new AccountService(config, new AccountStore(join(dir, 'accounts.json')));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.PASSKEY_ACCOUNT_CONTRACT_PATH;
  });

  it('uses smart-account as default self-deploy contract name', () => {
    expect(DEFAULT_SELF_DEPLOY_ACCOUNT_NAME).toBe('smart-account');
  });

  it('injects fully-qualified passkey-adapter into contract source for user-origin deploys', () => {
    const source = service.buildAccountContractSource();
    expect(source).toContain(
      "(use-trait exec-trait 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter.passkey-exec-trait)"
    );
    expect(source).toContain(
      "(contract-call? 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter forward-invoke"
    );
    expect(source).not.toContain('(use-trait exec-trait .passkey-adapter');
    expect(source).not.toContain('(contract-call? .passkey-adapter');
  });
});
