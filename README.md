# Stacks Passkey SDK

Wallet-less, seedless onboarding for Stacks — biometric smart accounts with gasless transactions via Clarity 5 **secp256r1** passkeys.

[![npm core](https://img.shields.io/npm/v/@stacks-passkey/core?label=core)](https://www.npmjs.com/package/@stacks-passkey/core)
[![npm react](https://img.shields.io/npm/v/@stacks-passkey/react?label=react)](https://www.npmjs.com/package/@stacks-passkey/react)
[![npm relay](https://img.shields.io/npm/v/@stacks-passkey/relay?label=relay)](https://www.npmjs.com/package/@stacks-passkey/relay)

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

**Published on npm** (v0.1.0): [`@stacks-passkey/core`](https://www.npmjs.com/package/@stacks-passkey/core) · [`@stacks-passkey/react`](https://www.npmjs.com/package/@stacks-passkey/react) · [`@stacks-passkey/relay`](https://www.npmjs.com/package/@stacks-passkey/relay) (self-hosted relay server)

**Hosted testnet relay:** `https://stacks-passkey-relay.onrender.com` — create an API key in the [dev portal](examples/demo/) (`/portal`) or use your own relay.

**Start here:**

- **[docs/GUIDE.md](docs/GUIDE.md)** — frontend dApp devs (SDK only, no relay/contracts to host)
- **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** — full stack (deploy + relay + frontend)

---

## Documentation

| Document | Description |
|----------|-------------|
| **[docs/GUIDE.md](docs/GUIDE.md)** | **Frontend-only** — use the SDK in your dApp without hosting relay or core contracts |
| **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** | Full stack — deploy contracts, run relay, catalog, production |
| [docs/SDK.md](docs/SDK.md) | API reference, types, relay endpoints |
| [examples/demo/README.md](examples/demo/README.md) | Reference dApp (interactive demo + example contract) |
| [packages/relay/SECURITY.md](packages/relay/SECURITY.md) | Relay sponsor key security |

---

## What it does

| Capability | SDK surface |
|------------|-------------|
| Passkey sign-up / sign-in | `register()`, `signIn()` |
| Self-deploy smart account | `register()` → `STorigin.smart-account` |
| Gasless transactions | `fee.mode: 'gasless'` + relay gas tank |
| Passkey-signed STX transfer | `transfer()` |
| Invoke registered app contracts | `invoke(contractId, fn, args)` |

Try it locally: `npm run dev:relay` + `npm run dev:demo` → open **http://localhost:3000** (unified portal: demo, docs, relay admin).

---

## Architecture

### Problem

Clarity requires **compile-time** function names for `contract-call?`. Passkey accounts need **runtime** function selection (user picks "swap", "mint", "vote", etc.). You cannot point a smart account at arbitrary third-party contract ABIs directly.

### Solution: self-deployed smart accounts + universal adapter

```
┌──────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   Browser    │────►│ STorigin.smart-account   │────►│ passkey-adapter │
│  WebAuthn    │     │ (user self-deploys)      │     │ forward-invoke  │
└──────────────┘     └────────────┬─────────────┘     └────────┬────────┘
                                  │                            │
                                  ▼                            ▼
                         ┌─────────────────┐          ┌─────────────────┐
                         │ passkey-factory │          │  your-app.clar  │
                         │ pubkey → account│          │  passkey-exec   │
                         └─────────────────┘          └─────────────────┘
```

**Protocol contracts** (deployed once by the platform):

1. **`passkey-factory.clar`** — On-chain registry mapping passkey pubkeys to each user's smart account principal. The relay registers mappings after the client deploys and registers keys.

2. **`passkey-account.clar`** — Smart account template. Each user deploys **`{origin}.smart-account`** from their passkey-derived origin key. Supports transfers, multi-device keys, and **`execute-via-adapter`**.

3. **`passkey-adapter.clar`** — Universal gateway with **`passkey-exec-trait`**, contract registry, and **`forward-invoke`**.

4. **Your app contract** — Implements the trait in your repo. See [`examples/demo/contracts/passkey-demo-app.clar`](examples/demo/contracts/passkey-demo-app.clar).

**Off-chain pieces:**

| Component | Role |
|-----------|------|
| **`@stacks-passkey/core`** | WebAuthn, sessions, self-deploy, tx building, `invoke()`, **`spk` CLI** |
| **`@stacks-passkey/react`** | `PasskeyProvider`, `usePasskeyAccount()` |
| **`@stacks-passkey/relay`** | Sponsors gas; serves account template; factory registry; app catalog |

### Sign-up flow (default: `passkey-smart`)

1. User creates a WebAuthn passkey
2. SDK derives an **origin private key** from the passkey public key
3. SDK fetches `GET /v1/accounts/template` → deploys **`STorigin.smart-account`** (relay-sponsored)
4. SDK calls `register` on the smart account with a passkey-signed tx
5. SDK → relay `POST /v1/accounts/ensure` with `originAddress` → relay registers pubkey in **`passkey-factory`**
6. Session stores `contractId` = `STorigin.smart-account`

Users fund **`{origin}.smart-account`** for STX transfers — not the origin address.

### Invoke flow

1. App calls `client.invoke('STxxx.my-app', 'set-score', { arg0: 42n, arg2: user })`
2. SDK → relay `POST /v1/catalog/ensure` → registers app on adapter if needed
3. SDK read-only `compute-invoke-hash` on the user's smart account
4. User approves WebAuthn signature
5. SDK builds `execute-via-adapter` → relay co-signs fee → broadcast
6. On-chain: smart account verifies secp256r1 → adapter checks registry → your app `passkey-exec`

Nested contract calls appear as **events** on the outer transaction (Hiro explorer shows `execute-via-adapter` on the smart account; the demo app's `set-score` event is under the tx **Events** tab).

### Smart account

Each user self-deploys **`STorigin.smart-account`** from a passkey-derived origin key. All transfers and contract calls are signed via WebAuthn and routed through the passkey adapter.

### Security model

- **Passkey private keys never leave the device enclave**
- **Relay cannot forge signatures** — only pays gas
- **Adapter registry** — only registered contracts reachable via invoke
- **Action hashes bind** nonce + target + function + args (replay protection via sign-count)

---

## Repository structure

```
stackspasskey/
├── contracts/                 # Core protocol contracts
│   ├── contracts/
│   │   ├── passkey-adapter.clar
│   │   ├── passkey-factory.clar
│   │   ├── passkey-account.clar   # template; users self-deploy as smart-account
│   │   ├── passkey-recovery.clar
│   │   └── webauthn-verifier.clar
│   └── tests/fixtures/        # mock-passkey-app (unit tests)
├── examples/
│   ├── demo/                  # Reference dApp — contract, manifest, frontend
│   └── relay-admin/           # Gas tank admin UI
├── packages/
│   ├── core/                  # SDK + spk CLI (bin: spk)
│   ├── react/                 # React hooks
│   └── relay/                 # Hono relay server
├── config/testnet.json        # Shared testnet deployment IDs
└── docs/
    ├── GUIDE.md               # Frontend integration
    ├── DEVELOPER_GUIDE.md     # Full-stack integration
    └── SDK.md                 # API reference
```

Example app contracts live under `examples/demo/`, not `contracts/`, so protocol vs. example code stays clear.

---

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| Core SDK | [`@stacks-passkey/core`](https://www.npmjs.com/package/@stacks-passkey/core) | WebAuthn client, self-deploy, actions, relay client, **`spk` CLI** |
| React | [`@stacks-passkey/react`](https://www.npmjs.com/package/@stacks-passkey/react) | `PasskeyProvider`, `usePasskeyAccount` |
| Relay | [`@stacks-passkey/relay`](https://www.npmjs.com/package/@stacks-passkey/relay) | Self-hostable sponsor + catalog + factory registry |

### spk CLI (bundled with core)

```bash
npx spk init                    # scaffold passkey.manifest.json
npx spk ensure STxxx.my-app     # register app via relay catalog
```

---

## Shared testnet deployment

Recorded in [`config/testnet.json`](config/testnet.json):

| Contract | Testnet ID |
|----------|------------|
| Factory | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-factory` |
| Adapter | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter` |
| Demo app | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app` |
| Recovery | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-recovery` |
| WebAuthn verifier | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.webauthn-verifier` |

Per-user smart accounts are **self-deployed** at `STorigin.smart-account` (not relay-deployed). There is no shared `passkey-account` contract on testnet.

---

## Quick start

```typescript
import { PasskeyClient } from '@stacks-passkey/core';
import { STACKS_TESTNET } from '@stacks/network';

const client = new PasskeyClient({
  network: STACKS_TESTNET,
  relayUrl: 'https://stacks-passkey-relay.onrender.com',
  relayApiKey: 'spk_...',
  deployerAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
  rpId: 'localhost',
  rpName: 'My App',
  origin: 'http://localhost:3000',
  fee: {
    mode: 'gasless',
    relayUrl: 'https://stacks-passkey-relay.onrender.com',
    relayApiKey: 'spk_...',
  },
});

await client.register(crypto.randomUUID(), 'Alice');
// session.contractId → STorigin.smart-account

await client.transfer('ST...deployer', 100n);

await client.invoke(
  'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app',
  'set-score',
  { arg0: 42n, arg2: client.getOriginAddress() }
);
```

React:

```tsx
import { PasskeyProvider, usePasskeyAccount } from '@stacks-passkey/react';

function App() {
  const { register, transfer, invoke, session } = usePasskeyAccount();
  // ...
}
```

---

## Local development

```bash
git clone <repo> && cd stackspasskey
npm install && npm run build

cp packages/relay/.env.example packages/relay/.env
./scripts/setup-relay-key.sh

npm run dev:relay     # :8787
npm run dev:demo      # :3000 — unified portal (demo + docs + admin)
npm run dev:admin     # alias for dev:demo
npm run test          # contracts + core + relay + e2e
```

**Demo env** (`examples/demo/.env`):

```env
VITE_RELAY_URL=https://stacks-passkey-relay.onrender.com
VITE_RELAY_API_KEY=spk_...          # create at /portal on the hosted relay
VITE_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
```

Use `VITE_RELAY_URL=http://localhost:8787` only when running `npm run dev:relay` locally.

**Relay env** (minimum for self-deploy):

```env
PASSKEY_FACTORY_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
PASSKEY_ADAPTER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
PASSKEY_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
ALLOWED_CONTRACTS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
```

The relay allowlist also permits any `*.smart-account` contract for register/invoke sponsorship after self-deploy.

### Deploy protocol contracts to testnet

```bash
./scripts/deploy-testnet.sh
```

Register the demo app (or let the SDK auto-ensure on first invoke):

```bash
export SPK_RELAY_API_KEY=spk_...
npx spk ensure ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app
```

---

## Fee modes

| Mode | Who pays gas | Use case |
|------|--------------|----------|
| `gasless` | Relay sponsor (project gas tank per API key) | Consumer apps, zero-STX UX |
| `account-pay` | Smart account reimburses relay on-chain | Users hold STX in their smart account |

Each relay API key maps to a project with its own **gas tank address** (visible in relay-admin).

---

## Relay API (summary)

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/accounts/template` | Smart account Clarity source (adapter refs injected for user-origin deploy) |
| `POST /v1/accounts/ensure` | Register pubkey → smart account in factory (requires `originAddress`) |
| `POST /v1/catalog/ensure` | Register app contract on passkey-adapter |
| `POST /sponsor` | Co-sign sponsored transactions |

See [docs/SDK.md](docs/SDK.md) for full request/response schemas.

---

## Testing

```bash
npm run test              # full suite (~63 tests)
npm run test:contracts    # Clarinet simnet tests
npm run test:unit         # SDK unit tests
npm run test:e2e          # simnet + self-deploy integration
```

---

## License

MIT
