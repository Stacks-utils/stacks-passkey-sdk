#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { createRelayApp } from './app.js';
import { loadRelayEnv } from './load-env.js';
import { assertRelayAuthConfigured, loadSponsorPrivateKey } from './secrets.js';
import { GasTankStore, defaultStorePath } from './gas-tank.js';
import type { RelayConfig } from './types.js';

loadRelayEnv();

function loadConfig(): RelayConfig {
  const network = (process.env.STACKS_NETWORK as RelayConfig['network']) ?? 'testnet';
  assertRelayAuthConfigured(network);

  return {
    sponsorPrivateKey: loadSponsorPrivateKey(),
    network,
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? '127.0.0.1',
    apiKey: process.env.RELAY_API_KEY,
    adminApiKey: process.env.RELAY_ADMIN_API_KEY,
    gasTankPath: process.env.GAS_TANK_PATH ?? defaultStorePath(),
    policy: {
      allowedContracts: process.env.ALLOWED_CONTRACTS?.split(',').filter(Boolean),
      maxFeeMicroStx: BigInt(process.env.MAX_FEE_MICRO_STX ?? '50000'),
      rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
        maxRequests: Number(process.env.RATE_LIMIT_MAX ?? '30'),
      },
    },
  };
}

const config = loadConfig();
const gasTank = new GasTankStore(config.gasTankPath!);

if (gasTank.listProjects().length === 0 && process.env.BOOTSTRAP_DEMO_PROJECT === 'true') {
  const demo = gasTank.createProject('Demo App', 5_000_000n);
  console.log(`Bootstrapped demo project API key: ${demo.apiKey}`);
}

const app = createRelayApp(config, gasTank);

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(`Stacks Passkey relay listening on http://${config.host}:${config.port}`);
  console.log(`Gas tank store: ${config.gasTankPath}`);
});
