#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [, , command, ...rest] = process.argv;

function usage() {
  console.log(`Stacks Passkey CLI (spk)

Usage:
  spk init [dir]                 Scaffold passkey.manifest.json
  spk ensure <contractId>        Register contract via relay catalog API
  spk help

Environment (ensure):
  SPK_RELAY_URL, SPK_RELAY_API_KEY
`);
}

async function cmdInit(dir = '.') {
  const manifestPath = join(dir, 'passkey.manifest.json');
  if (existsSync(manifestPath)) {
    console.error(`Already exists: ${manifestPath}`);
    process.exit(1);
  }
  mkdirSync(dirname(manifestPath), { recursive: true });
  const manifest = {
    name: 'my-app',
    contract: 'STxxx.my-app',
    functions: [
      { name: 'set-score', args: [{ slot: 'arg0', type: 'uint' }, { slot: 'arg2', type: 'principal' }] },
    ],
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Created ${manifestPath}`);
  console.log('Implement passkey-exec in your Clarity contract (see docs/SDK.md).');
}

async function cmdEnsure(contractId: string) {
  const relayUrl = process.env.SPK_RELAY_URL ?? process.env.VITE_RELAY_URL ?? 'http://localhost:8787';
  const apiKey = process.env.SPK_RELAY_API_KEY ?? process.env.VITE_RELAY_API_KEY;
  if (!apiKey) {
    console.error('Set SPK_RELAY_API_KEY or VITE_RELAY_API_KEY');
    process.exit(1);
  }
  const res = await fetch(`${relayUrl.replace(/\/$/, '')}/v1/catalog/ensure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ contractId }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(body.error ?? res.statusText);
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  switch (command) {
    case 'init':
      await cmdInit(rest[0]);
      break;
    case 'ensure':
      if (!rest[0]) {
        console.error('Usage: spk ensure STxxx.contract-name');
        process.exit(1);
      }
      await cmdEnsure(rest[0]);
      break;
    case 'help':
    case undefined:
      usage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
