import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { RelayConfig } from './types.js';
import { RateLimiter } from './rate-limit.js';
import { SponsorService } from './sponsor.js';
import { GasTankStore } from './gas-tank.js';
import { CatalogStore, defaultCatalogPath } from './catalog.js';
import { CatalogService } from './catalog-service.js';
import { AccountStore, defaultAccountsPath } from './accounts.js';
import { AccountService } from './account-service.js';
import { verifySessionToken } from './crypto.js';
import {
  createWalletSession,
  issueAuthChallengeForNetwork,
  verifyAuthSignatureWithReason,
} from './wallet-auth.js';
import { fetchStxBalanceMicro } from './on-chain-balance.js';

function resolveSessionAddress(c: { req: { header: (name: string) => string | undefined } }, config: RelayConfig): string | null {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token.startsWith('spk_')) return null;
  return verifySessionToken(token, config.sessionSecret)?.address ?? null;
}

function isAdminKey(c: { req: { header: (name: string) => string | undefined } }, config: RelayConfig): boolean {
  if (!config.adminApiKey) return true;
  return c.req.header('X-Admin-Key') === config.adminApiKey;
}

export function createRelayApp(config: RelayConfig, gasTank?: GasTankStore) {
  const app = new Hono();
  const sponsor = new SponsorService(config, gasTank);
  const limiter = new RateLimiter(config.policy);
  const catalog = new CatalogStore(process.env.CATALOG_PATH ?? defaultCatalogPath());
  const catalogService = new CatalogService(config, catalog, gasTank);
  const accountStore = new AccountStore(process.env.ACCOUNTS_PATH ?? defaultAccountsPath());
  const accountService = new AccountService(config, accountStore, gasTank);

  app.use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    })
  );

  app.get('/health', (c) =>
    c.json({
      ok: true,
      registrarAddress: sponsor.getRegistrarAddress(),
      network: config.network,
      auth: 'wallet-signature',
    })
  );

  app.get('/v1/accounts/template', (c) => c.json(accountService.getAccountContractTemplate()));

  // --- Wallet signature auth ---
  app.get('/v1/auth/challenge', (c) => {
    const address = c.req.query('address');
    if (!address) return c.json({ error: 'Missing address query param' }, 400);
    const challenge = issueAuthChallengeForNetwork(address, config.network);
    return c.json({
      address,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt,
      plainMessage: challenge.plainMessage,
      domain: {
        name: process.env.RELAY_AUTH_DOMAIN ?? 'localhost',
        version: '1.0.0',
        'chain-id': config.network === 'mainnet' ? 1 : 0x80000000,
      },
      message: {
        action: 'authenticate',
        address,
        nonce: challenge.nonce,
        expires: challenge.expiresAt,
      },
    });
  });

  app.post('/v1/auth/verify', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const body = await c.req.json<{
      address?: string;
      signature?: string;
      publicKey?: string;
      nonce?: string;
      expiresAt?: number;
      mode?: 'structured' | 'plain';
      plainMessage?: string;
    }>();
    if (!body.address || !body.signature || !body.publicKey || !body.nonce || !body.expiresAt) {
      return c.json({ error: 'Missing auth fields' }, 400);
    }
    const verified = verifyAuthSignatureWithReason({
      address: body.address,
      signature: body.signature,
      publicKey: body.publicKey,
      nonce: body.nonce,
      expiresAt: body.expiresAt,
      network: config.network,
      mode: body.mode,
      plainMessage: body.plainMessage,
    });
    if (!verified.ok) {
      const messages: Record<string, string> = {
        missing_challenge: 'Sign-in expired or was replaced. Click Sign in again.',
        nonce_mismatch: 'Sign-in challenge changed while signing. Click Sign in again.',
        expires_mismatch: 'Sign-in challenge changed while signing. Click Sign in again.',
        expired: 'Sign-in challenge expired. Click Sign in again.',
        bad_signature: 'Signature did not match the connected wallet. Try Sign in again.',
      };
      return c.json({ error: messages[verified.reason] ?? 'Invalid or expired signature' }, 401);
    }

    gasTank.ensureWallet(body.address);
    const session = createWalletSession(body.address, config.sessionSecret);
    return c.json({
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      address: body.address,
    });
  });

  // --- Wallet dashboard (session auth) ---
  app.get('/v1/wallet/me', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const address = resolveSessionAddress(c, config);
    if (!address) return c.json({ error: 'Unauthorized' }, 401);
    const wallet = gasTank.ensureWallet(address);
    const onChain = await fetchStxBalanceMicro(wallet.sponsorAddress, config.network);
    const available = gasTank.availableBalance(onChain, wallet);
    return c.json({
      walletId: wallet.id,
      ownerAddress: wallet.ownerAddress,
      sponsorAddress: wallet.sponsorAddress,
      gasBalanceMicroStx: onChain.toString(),
      availableMicroStx: available.toString(),
      reservedMicroStx: wallet.reservedMicroStx.toString(),
      totalSpentMicroStx: wallet.totalSpentMicroStx.toString(),
      txCount: wallet.txCount,
      createdAt: wallet.createdAt,
    });
  });

  app.get('/v1/wallet/keys', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const address = resolveSessionAddress(c, config);
    if (!address) return c.json({ error: 'Unauthorized' }, 401);
    const wallet = gasTank.getWalletByOwner(address);
    if (!wallet) return c.json({ keys: [] });
    return c.json({
      keys: gasTank.listApiKeys(wallet.id).map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt,
      })),
    });
  });

  app.post('/v1/wallet/keys', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const address = resolveSessionAddress(c, config);
    if (!address) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json<{ name?: string }>();
    if (!body.name?.trim()) return c.json({ error: 'Missing name' }, 400);
    const wallet = gasTank.ensureWallet(address);
    const { apiKey, record } = gasTank.createApiKey(wallet.id, body.name.trim());
    return c.json({
      id: record.id,
      name: record.name,
      apiKey,
      keyPrefix: record.keyPrefix,
      createdAt: record.createdAt,
      warning: 'Store this API key securely — it is shown only once.',
    });
  });

  app.delete('/v1/wallet/keys/:id', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const address = resolveSessionAddress(c, config);
    if (!address) return c.json({ error: 'Unauthorized' }, 401);
    const wallet = gasTank.getWalletByOwner(address);
    if (!wallet) return c.json({ error: 'Wallet not registered' }, 404);
    try {
      const revoked = gasTank.revokeApiKey(wallet.id, c.req.param('id'));
      return c.json({ id: revoked.id, revokedAt: revoked.revokedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Revoke failed';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/v1/wallet/logs', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const address = resolveSessionAddress(c, config);
    if (!address) return c.json({ error: 'Unauthorized' }, 401);
    const wallet = gasTank.getWalletByOwner(address);
    if (!wallet) return c.json({ logs: [] });
    return c.json({
      logs: gasTank.getLogs(wallet.id).map((l) => ({
        ...l,
        feeMicroStx: l.feeMicroStx.toString(),
      })),
    });
  });

  // --- SDK project info (API key auth) ---
  app.get('/v1/project', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);
    const resolved = gasTank.resolveApiKey(apiKey);
    if (!resolved) return c.json({ error: 'Invalid or revoked API key' }, 401);
    const onChain = await fetchStxBalanceMicro(resolved.wallet.sponsorAddress, config.network);
    const available = gasTank.availableBalance(onChain, resolved.wallet);
    return c.json({
      walletId: resolved.wallet.id,
      projectId: resolved.wallet.id,
      projectName: resolved.apiKey.name,
      gasTankAddress: resolved.wallet.sponsorAddress,
      gasBalanceMicroStx: onChain.toString(),
      availableMicroStx: available.toString(),
      totalSpentMicroStx: resolved.wallet.totalSpentMicroStx.toString(),
      txCount: resolved.wallet.txCount,
    });
  });

  // --- Legacy admin (X-Admin-Key) — list only ---
  app.get('/v1/admin/projects', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (!isAdminKey(c, config)) return c.json({ error: 'Unauthorized' }, 401);
    const wallets = await Promise.all(
      gasTank.listWallets().map(async (w) => {
        const onChain = await fetchStxBalanceMicro(w.sponsorAddress, config.network);
        return {
          id: w.id,
          name: w.ownerAddress,
          ownerAddress: w.ownerAddress,
          gasTankAddress: w.sponsorAddress,
          gasBalanceMicroStx: onChain.toString(),
          availableMicroStx: gasTank.availableBalance(onChain, w).toString(),
          totalSpentMicroStx: w.totalSpentMicroStx.toString(),
          txCount: w.txCount,
          createdAt: w.createdAt,
        };
      })
    );
    return c.json({ projects: wallets });
  });

  app.get('/v1/admin/projects/:id/logs', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    if (!isAdminKey(c, config)) return c.json({ error: 'Unauthorized' }, 401);
    return c.json({
      logs: gasTank.getLogs(c.req.param('id')).map((l) => ({
        ...l,
        projectId: l.walletId,
        feeMicroStx: l.feeMicroStx.toString(),
      })),
    });
  });

  app.get('/v1/catalog', (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);
    const resolved = gasTank.resolveApiKey(apiKey);
    if (!resolved) return c.json({ error: 'Invalid API key' }, 401);
    return c.json({ contracts: catalog.listForProject(resolved.wallet.id) });
  });

  app.post('/v1/catalog/ensure', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);
    const resolved = gasTank.resolveApiKey(apiKey);
    if (!resolved) return c.json({ error: 'Invalid API key' }, 401);

    const body = await c.req.json<{ contractId?: string }>();
    if (!body.contractId) return c.json({ error: 'Missing contractId' }, 400);

    try {
      const result = await catalogService.ensureContract(resolved.wallet.id, body.contractId);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Catalog ensure failed';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/v1/accounts/ensure', async (c) => {
    if (!gasTank) return c.json({ error: 'Gas tank not enabled' }, 503);
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);
    const resolved = gasTank.resolveApiKey(apiKey);
    if (!resolved) return c.json({ error: 'Invalid API key' }, 401);

    const body = await c.req.json<{
      publicKeyHex?: string;
      originAddress?: string;
      contractName?: string;
    }>();
    if (!body.publicKeyHex) return c.json({ error: 'Missing publicKeyHex' }, 400);
    if (!body.originAddress) return c.json({ error: 'Missing originAddress' }, 400);

    try {
      const result = await accountService.ensureAccount(resolved.wallet.id, body.publicKeyHex, {
        originAddress: body.originAddress,
        contractName: body.contractName,
      });
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Account ensure failed';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/sponsor', async (c) => {
    const auth = c.req.header('Authorization');
    const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    let walletId: string | undefined;
    let apiKeyId: string | undefined;
    let sponsorPrivateKey: string | undefined;
    let sponsorAddress: string | undefined;

    if (gasTank && apiKey) {
      const resolved = gasTank.resolveApiKey(apiKey);
      if (!resolved) {
        return c.json({ status: 'rejected', reason: 'Invalid or revoked API key' }, 401);
      }
      walletId = resolved.wallet.id;
      apiKeyId = resolved.apiKey.id;
      sponsorPrivateKey = resolved.sponsorPrivateKey;
      sponsorAddress = resolved.wallet.sponsorAddress;
    } else if (config.apiKey) {
      if (auth !== `Bearer ${config.apiKey}`) {
        return c.json({ status: 'rejected', reason: 'Unauthorized' }, 401);
      }
    }

    const clientIp = c.req.header('x-forwarded-for') ?? 'local';
    if (!limiter.check(clientIp)) {
      return c.json({ status: 'rejected', reason: 'Rate limit exceeded' }, 429);
    }

    const body = await c.req.json<{
      txHex?: string;
      billingMode?: 'gasless' | 'account-pay';
      estimatedFeeMicroStx?: string;
    }>();
    if (!body.txHex) {
      return c.json({ status: 'rejected', reason: 'Missing txHex' }, 400);
    }

    const billingMode = body.billingMode ?? 'gasless';

    if (gasTank && walletId && billingMode === 'gasless' && sponsorAddress) {
      const wallet = gasTank.getWalletById(walletId);
      const minFee = config.policy.maxFeeMicroStx;
      if (wallet) {
        const onChain = await fetchStxBalanceMicro(sponsorAddress, config.network);
        if (gasTank.availableBalance(onChain, wallet) < minFee) {
          return c.json(
            {
              status: 'rejected',
              reason: `Insufficient gas tank balance. Deposit STX to ${sponsorAddress}`,
            },
            402
          );
        }
      }
    }

    try {
      const result = await sponsor.sponsorAndBroadcast(body.txHex, {
        walletId,
        apiKeyId,
        sponsorPrivateKey,
        sponsorAddress,
        billingMode,
        estimatedFeeMicroStx: body.estimatedFeeMicroStx ? BigInt(body.estimatedFeeMicroStx) : undefined,
      });
      if (result.status === 'rejected') {
        return c.json(result, 400);
      }
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown relay error';
      return c.json({ status: 'rejected', reason: message }, 500);
    }
  });

  return app;
}
