# Stacks Passkey — End-to-End Developer Guide

This guide walks you from zero to a working passkey-powered Stacks dApp: contracts, relay, catalog registration, frontend, and testnet deployment. Read this top-to-bottom on your first integration.

**Related docs:** [Frontend SDK guide (GUIDE.md)](./GUIDE.md) · [Full stack guide (DEVELOPER_GUIDE.md)](./DEVELOPER_GUIDE.md) · [SDK API reference](./SDK.md) · [Relay security](../packages/relay/SECURITY.md) · [Demo example](../examples/demo/README.md)

---

## Table of contents

1. [What you are building](#1-what-you-are-building)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Phase 1 — Deploy core contracts](#5-phase-1--deploy-core-contracts)
6. [Phase 2 — Write your app contract](#6-phase-2--write-your-app-contract)
7. [Phase 3 — Run the relay](#7-phase-3--run-the-relay)
8. [Phase 4 — Register your app (catalog)](#8-phase-4--register-your-app-catalog)
9. [Phase 5 — Frontend / SDK setup](#9-phase-5--frontend--sdk-setup)
10. [Phase 6 — User flows](#10-phase-6--user-flows)
11. [Phase 7 — Test locally](#11-phase-7--test-locally)
12. [Configuration reference](#12-configuration-reference)
13. [Production checklist](#13-production-checklist)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What you are building

Stacks Passkey gives your web app **wallet-less onboarding**:

- Users sign up with Face ID / Touch ID (WebAuthn P-256)
- Their smart account is a **per-user Clarity contract** (`passkey-acc-{hash}`) deployed by the relay on first sign-up
- Transactions are authorized by passkey signature verified on-chain (`secp256r1-verify`)
- Gas can be **sponsored by your relay** (gasless UX) or reimbursed from the contract STX balance

To call **your app's contract functions**, you do not modify `passkey-account` per app. Instead:

1. Your contract implements `passkey-exec-trait` (from `passkey-adapter`)
2. Your relay registers your contract on `passkey-adapter`
3. The SDK calls `client.invoke('STxxx.my-app', 'my-function', args)` which routes through the adapter

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                 │
│  WebAuthn ──► @stacks-passkey/core ──► Relay (gas + account deploy)    │
└───────────────────────────────────────────────┬─────────────────────────┘
                                                │
                    ┌───────────────────────────▼──────────────────────────┐
                    │ passkey-acc-{hash}.clar (per user)                   │
                    │  register / transfer-stx / execute-via-adapter ──┐   │
                    └───────────────────────────────┬──────────────────│───┘
                                                    │                  │
                    ┌───────────────────────────────▼──────────┐       │
                    │ passkey-factory.clar (pubkey → account)  │       │
                    └──────────────────────────────────────────┘       │
                                                                       │
                    ┌──────────────────────────────────────────────────▼──┐
                    │ passkey-adapter.clar                                  │
                    │  register-contract / forward-invoke                   │
                    └──────────────────────────────────────────┬──────────┘
                                                                 │
                    ┌────────────────────────────────────────────▼──────────┐
                    │ YOUR-APP.clar                                           │
                    │  passkey-exec(function-name, arg0..arg4)              │
                    └─────────────────────────────────────────────────────────┘
```

### Key contracts (core — in `contracts/contracts/`)

| Contract | Role |
|----------|------|
| `passkey-factory.clar` | Registry: passkey pubkey → user's account contract principal |
| `passkey-adapter.clar` | Defines `passkey-exec-trait`, maintains registry, forwards invokes |
| `passkey-account.clar` | Account template; relay deploys one instance per user |
| `passkey-recovery.clar` | Optional social recovery (guardians + timelock) |
| `webauthn-verifier.clar` | Shared verification helpers |

### Example app (NOT core — in `examples/demo/`)

| File | Role |
|------|------|
| `examples/demo/contracts/passkey-demo-app.clar` | Sample `passkey-exec` implementation (`set-score`, etc.) |
| `examples/demo/passkey.manifest.json` | Documents callable functions for tooling |

### Invoke argument slots

All dynamic calls use five typed slots passed through the adapter:

| Slot | Clarity type | Typical use |
|------|--------------|-------------|
| `arg0` | `uint` | Amounts, scores, IDs |
| `arg1` | `uint` | Secondary numeric |
| `arg2` | `principal` | User account, recipient |
| `arg3` | `principal` | Secondary principal |
| `arg4` | `(buff 1024)` | Opaque payload |

Your `passkey-exec` function reads these slots and dispatches internally.

---

## 3. Repository layout

```
stackspasskey/
├── contracts/                    # CORE on-chain contracts (product)
│   ├── contracts/
│   │   ├── passkey-adapter.clar
│   │   ├── passkey-account.clar
│   │   ├── passkey-recovery.clar
│   │   └── webauthn-verifier.clar
│   ├── tests/fixtures/           # mock-passkey-app.clar (unit tests only)
│   └── deployments/
│       ├── default.simnet-plan.yaml
│       ├── default.testnet-plan.yaml    # adapter + account
│       └── demo-app.testnet-plan.yaml   # publishes examples/demo contract
├── examples/
│   ├── demo/                     # Reference dApp (contract + frontend)
│   └── relay-admin/              # Gas tank / API key dashboard
├── packages/
│   ├── core/                     # SDK + spk CLI
│   ├── react/                    # PasskeyProvider, usePasskeyAccount
│   └── relay/                    # Sponsored tx + catalog API
├── config/testnet.json           # Shared testnet contract IDs
└── docs/
    ├── DEVELOPER_GUIDE.md        # ← this file
    └── SDK.md                    # API reference
```

**Rule:** Anything showing how a developer integrates (demo app contract, manifest, frontend) lives under `examples/`. The `contracts/` package is only the reusable protocol.

---

## 4. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js ≥ 20 | Build + relay |
| Clarinet ≥ 3.21 | Contract check + deploy |
| Testnet STX | Fund deployer + relay sponsor |
| HTTPS or localhost | WebAuthn secure context |
| Clarity 5 / Epoch 3.4+ | Required for `secp256r1-verify` |

Shared testnet deployer (this repo): `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ`

---

## 5. Phase 1 — Deploy core contracts

### 5.1 Check contracts compile

```bash
cd contracts
clarinet check -d
npm run test
```

### 5.2 Deploy to testnet

```bash
# From repo root — deploys passkey-factory (adapter/demo may already exist)
./scripts/deploy-testnet.sh
```

Deployer settings: `contracts/settings/Testnet.toml` (never commit real mainnet keys).

Per-user account instances are **not** in the deployment plan — the relay deploys them via `POST /v1/accounts/ensure`.

### 5.3 Record deployment IDs

Update `config/testnet.json` with factory + adapter IDs.

**Current shared testnet:**

| Contract | ID |
|----------|-----|
| Factory | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-factory` |
| Adapter | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter` |
| Demo app | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app` |

---

## 6. Phase 2 — Write your app contract

Copy the pattern from `examples/demo/contracts/passkey-demo-app.clar`:

```clarity
(impl-trait .passkey-adapter.passkey-exec-trait)

(define-public (passkey-exec
    (function-name (string-ascii 128))
    (arg0 uint) (arg1 uint)
    (arg2 principal) (arg3 principal)
    (arg4 (buff 1024))
  )
  (begin
    ;; Use asserts! for unknown functions (nested if + err breaks trait validation)
    (asserts! (is-eq function-name "set-score") ERR-UNKNOWN-FUNCTION)
    ;; Your logic using arg0, arg2, ...
    (ok u1)
  )
)
```

**Important Clarity rules:**

1. Trait is defined on **`passkey-adapter`**, not on your account contract
2. Use `(impl-trait .passkey-adapter.passkey-exec-trait)` — adapter must exist on same deployer for local simnet
3. Unknown function branches must use top-level `asserts!`, not nested `(err ...)` inside `if`
4. Comments must be ASCII-only (no em-dashes)

Deploy your app:

```bash
# Add a row to a deployment plan or use clarinet publish
clarinet deployments apply -p your-app.testnet-plan.yaml
```

Create `passkey.manifest.json` in your project (or run `npx spk init`):

```json
{
  "name": "my-app",
  "contract": "STxxx.my-app",
  "functions": [
    { "name": "set-score", "args": [
      { "slot": "arg0", "type": "uint" },
      { "slot": "arg2", "type": "principal" }
    ]}
  ]
}
```

---

## 7. Phase 3 — Run the relay

The relay sponsors transaction fees and runs the **catalog service** (auto-registers app contracts on `passkey-adapter`).

```bash
cp packages/relay/.env.example packages/relay/.env
./scripts/setup-relay-key.sh   # creates packages/relay/sponsor.key
```

**Required `.env` values:**

```env
PORT=8787
STACKS_NETWORK=testnet
SPONSOR_PRIVATE_KEY_FILE=./sponsor.key
GAS_TANK_PATH=./data/gas-tank.json
BOOTSTRAP_DEMO_PROJECT=true

# Sponsor only txs to your deployer's contracts
ALLOWED_CONTRACTS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ

# Catalog registration target
PASSKEY_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
PASSKEY_ADAPTER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
PASSKEY_ADAPTER_NAME=passkey-adapter

# Factory — per-user account deployment
PASSKEY_FACTORY_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
PASSKEY_FACTORY_NAME=passkey-factory
```

Start relay:

```bash
npm run dev:relay
```

Create / retrieve a project API key (`spk_...`):

- Bootstrapped on first start if `BOOTSTRAP_DEMO_PROJECT=true` (check console log)
- Or use relay-admin at `npm run dev:admin`
- Or read `packages/relay/data/gas-tank.json`

Fund the sponsor wallet with testnet STX.

---

## 8. Phase 4 — Register your app (catalog)

Before users can `invoke` your contract, it must be registered on `passkey-adapter`.

### Option A — SDK auto-ensure (recommended)

`PasskeyClient.invoke()` calls `POST /v1/catalog/ensure` before signing. No manual step if relay is configured.

### Option B — CLI

```bash
npm install @stacks-passkey/core   # spk ships with this package
export SPK_RELAY_URL=http://localhost:8787
export SPK_RELAY_API_KEY=spk_...
npx spk ensure ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app
```

### Option C — HTTP

```bash
curl -X POST http://localhost:8787/v1/catalog/ensure \
  -H "Authorization: Bearer spk_..." \
  -H "Content-Type: application/json" \
  -d '{"contractId":"STxxx.my-app"}'
```

The relay will:

1. Fetch your contract interface from Hiro API
2. Verify `passkey-exec` exists
3. Submit `register-contract` on `passkey-adapter` (billed to project gas tank)
4. Cache registration in local catalog store

---

## 9. Phase 5 — Frontend / SDK setup

### Install

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

### Environment (Vite example — see `examples/demo/.env.example`)

```env
VITE_RELAY_URL=http://localhost:8787
VITE_RELAY_API_KEY=spk_your_project_key
VITE_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
VITE_FACTORY_NAME=passkey-factory
```

### PasskeyClient config

```typescript
import { PasskeyClient } from '@stacks-passkey/core';
import { STACKS_TESTNET } from '@stacks/network';

const client = new PasskeyClient({
  network: STACKS_TESTNET,
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  deployerAddress: import.meta.env.VITE_DEPLOYER_ADDRESS,
  factoryName: import.meta.env.VITE_FACTORY_NAME ?? 'passkey-factory',
  rpId: window.location.hostname,
  rpName: 'My App',
  origin: window.location.origin,
  fee: {
    mode: 'gasless',
    relayUrl: import.meta.env.VITE_RELAY_URL,
    relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  },
});
```

### React wrapper

```tsx
import { PasskeyProvider, usePasskeyAccount } from '@stacks-passkey/react';

<PasskeyProvider config={passkeyConfig}>
  <App />
</PasskeyProvider>

// Inside App:
const { register, signIn, transfer, invoke } = usePasskeyAccount();
```

### Config module pattern (from demo)

See `examples/demo/src/config.ts` — imports shared IDs from `config/testnet.json` with env overrides.

---

## 10. Phase 6 — User flows

### Sign up

```typescript
await client.register(crypto.randomUUID(), 'Alice');
// Submits passkey-account.register(public-key) via relay
```

### Sign in

```typescript
const session = await client.signIn();
// session.publicKeyHex, session.credentialId stored in localStorage
```

### Transfer STX

```typescript
await client.executeAction(
  { type: 'transfer', recipient: 'ST...', amount: 1000n },
  hexToBytes(session.publicKeyHex),
  session.credentialId
);
```

Fund the **passkey-account contract** with STX for transfers (shared pool).

### Invoke your app

```typescript
await client.invoke(
  'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app',
  'set-score',
  { arg0: 42n, arg2: client.getOriginAddress() }
);
```

**What happens on-chain:**

1. SDK → relay `/v1/catalog/ensure` (if needed)
2. SDK fetches `compute-invoke-hash` from passkey-account
3. WebAuthn signs hash
4. SDK builds `execute-via-adapter` tx → relay sponsors → broadcast
5. `passkey-account` → `passkey-adapter.forward-invoke` → `your-app.passkey-exec`

---

## 11. Phase 7 — Test locally

```bash
npm install && npm run build
npm run test                 # contracts + core + relay + e2e
npm run dev:relay            # terminal 1
npm run dev:demo             # terminal 2 — http://localhost:3000
```

E2E tests use `mock-passkey-app` (test fixture in `contracts/tests/fixtures/`), not the demo example contract.

---

## 12. Configuration reference

### `config/testnet.json`

Canonical shared deployment record. Frontend examples import this.

### Relay env

| Variable | Required | Description |
|----------|----------|-------------|
| `SPONSOR_PRIVATE_KEY_FILE` | Yes | Pays tx fees |
| `PASSKEY_DEPLOYER_ADDRESS` | Yes for accounts | Deployer for per-user account instances |
| `PASSKEY_FACTORY_ADDRESS` | Yes for accounts | Factory registry deployer address |
| `PASSKEY_FACTORY_NAME` | No (default `passkey-factory`) | Factory contract name |
| `PASSKEY_ADAPTER_ADDRESS` | Yes for catalog | Adapter deployer address |
| `PASSKEY_ADAPTER_NAME` | No (default `passkey-adapter`) | Adapter contract name |
| `ALLOWED_CONTRACTS` | Recommended | Deployer allowlist for sponsor |
| `GAS_TANK_PATH` | Yes | Project API keys + balances |
| `REGISTRAR_PRIVATE_KEY` | No | Defaults to sponsor key for deploy/register txs |
| `ACCOUNTS_PATH` | No | Persist pubkey → account mappings |

### SDK / PasskeyClient

| Field | Description |
|-------|-------------|
| `deployerAddress` | Factory + adapter deployer (required in factory mode) |
| `factoryName` | Factory contract name (default `passkey-factory`) |
| `useFactory` | Default `true`; set `false` + `contractName` for legacy shared account |
| `relayUrl` + `relayApiKey` | Gas sponsorship, account deploy, catalog |
| `rpId` | Must match WebAuthn RP ID (usually hostname) |
| `origin` | Full origin URL |
| `fee.mode` | `gasless` or `account-pay` |

### spk CLI

Ships with `@stacks-passkey/core`:

```bash
npx spk init [dir]              # create passkey.manifest.json
npx spk ensure STxxx.contract   # catalog registration
npx spk help
```

---

## 13. Production checklist

```
□ Deploy passkey-adapter + passkey-factory on your deployer
□ Deploy your app contract with passkey-exec
□ Run relay with sponsor key in secure storage (not env inline)
□ Set ALLOWED_CONTRACTS, PASSKEY_FACTORY_ADDRESS, PASSKEY_DEPLOYER_ADDRESS
□ Create per-app relay API keys; proxy keys through your backend in production
□ Fund sponsor wallet + monitor gas tank balances
□ Serve frontend over HTTPS (WebAuthn requirement)
□ Users fund their own smart account (`session.contractId`) for transfers
□ Test register → transfer → invoke on testnet before mainnet
```

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `invoke` fails with catalog error | Relay missing `PASSKEY_ADAPTER_ADDRESS` | Set env, restart relay |
| `ERR-NOT-REGISTERED` on-chain | App not on adapter registry | Run `spk ensure STxxx.app` |
| Transfer fails | Empty user smart account STX | Fund `session.contractId` on explorer |
| Account ensure fails | Relay missing factory env or gas | Set `PASSKEY_FACTORY_ADDRESS`, refill gas tank |
| WebAuthn fails | Not HTTPS / wrong rpId | Use localhost or HTTPS; match hostname |
| `passkey-exec` trait error | Wrong trait source or nested `err` in if | Use `.passkey-adapter.passkey-exec-trait`; use `asserts!` |
| Relay 401 | Wrong API key | Check `gas-tank.json` or admin dashboard |
| Contract name mismatch | Legacy shared account mode | Use `deployerAddress` only (factory default) or set `useFactory: false` |

---

## Quick command reference

```bash
# Build + test everything
npm run build && npm run test

# Deploy core + demo to testnet
./scripts/deploy-testnet.sh

# Local dev
npm run dev:relay
npm run dev:demo

# Register app contract
npx spk ensure STxxx.my-app
```

For API-level detail see [SDK.md](./SDK.md).
