import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Cl } from '@stacks/transactions';
import { serve, type ServerType } from '@hono/node-server';
import { createRelayApp } from '@stacks-passkey/relay';
import { createTestPasskey, signWebAuthn, cvToBytes } from '../../contracts/tests/helpers/webauthn.js';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet2 = accounts.get('wallet_2')!;
const contractId = `${deployer}.passkey-account`;

describe('stacks passkey e2e', () => {
  let relayServer: ServerType;
  let relayUrl: string;
  const sponsorKey = '753b7cc01a1855527860d90776314512f5f16cc592133f14327856e06653810e01';

  beforeAll(async () => {
    const app = createRelayApp({
      sponsorPrivateKey: sponsorKey,
      network: 'devnet',
      port: 0,
      policy: {
        allowedContracts: [contractId.split('.')[0]],
        maxFeeMicroStx: 50_000n,
        rateLimit: { windowMs: 60_000, maxRequests: 100 },
      },
    });

    relayServer = serve({ fetch: app.fetch, port: 0 });
    const address = relayServer.address();
    const port = typeof address === 'object' && address ? address.port : 8787;
    relayUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => relayServer.close(() => resolve()));
  });

  it('runs full registration → transfer flow through relay', async () => {
    const passkey = createTestPasskey();

    const { result: registerResult } = simnet.callPublicFn(
      'passkey-account',
      'register',
      [Cl.buffer(passkey.publicKey)],
      deployer
    );
    expect(registerResult).toBeOk(Cl.bool(true));
    simnet.transferSTX(100_000, contractId, deployer);

    const recipient = wallet2;
    const amount = 2500n;

    const { result: hashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-transfer-hash',
      [Cl.principal(recipient), Cl.uint(amount)],
      deployer
    );
    const actionHash = cvToBytes(hashResult.value);
    const assertion = signWebAuthn(passkey.privateKey, actionHash, 'localhost', 1);

    const balanceBefore = simnet.getAssetsMap().get('STX')?.get(recipient) ?? 0n;

    const { result: transferResult } = simnet.callPublicFn(
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

    expect(transferResult).toBeOk(Cl.bool(true));
    const balanceAfter = simnet.getAssetsMap().get('STX')?.get(recipient) ?? 0n;
    expect(balanceAfter - balanceBefore).toBe(amount);
  });

  it('relay health endpoint responds', async () => {
    const res = await fetch(`${relayUrl}/health`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { ok: boolean; sponsorAddress: string };
    expect(body.ok).toBe(true);
    expect(body.sponsorAddress).toMatch(/^S[PT]/);
  });

  it('supports multi-device add-key e2e', async () => {
    const primary = createTestPasskey();
    const secondary = createTestPasskey();

    simnet.callPublicFn('passkey-account', 'register', [Cl.buffer(primary.publicKey)], deployer);

    const { result: addHashResult } = simnet.callReadOnlyFn(
      'passkey-account',
      'compute-add-key-hash',
      [Cl.buffer(secondary.publicKey)],
      deployer
    );
    const addHash = cvToBytes(addHashResult.value);
    const addAssertion = signWebAuthn(primary.privateKey, addHash, 'localhost', 1);

    const { result } = simnet.callPublicFn(
      'passkey-account',
      'add-key',
      [
        Cl.buffer(secondary.publicKey),
        Cl.buffer(primary.publicKey),
        Cl.buffer(addAssertion.signature),
        Cl.buffer(addAssertion.authenticatorData),
        Cl.buffer(addAssertion.clientDataJSON),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const { result: authorized } = simnet.callReadOnlyFn(
      'passkey-account',
      'is-key-authorized',
      [Cl.buffer(secondary.publicKey)],
      deployer
    );
    expect(authorized).toBeOk(Cl.bool(true));
  });
});
