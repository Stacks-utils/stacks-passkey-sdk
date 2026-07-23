# Frontend SDK Guide

**For dApp developers who want passkeys in their app without running the relay or deploying core contracts.**

You install npm packages, point at shared testnet infrastructure, build your UI, and ship. Someone else (your team, a platform operator, or this repo's shared testnet) runs the relay and passkey-account contracts.

**Not this guide?** If you deploy contracts and host the relay yourself, read [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

---

## Table of contents

1. [What you are responsible for](#1-what-you-are-responsible-for)
2. [What is already provided](#2-what-is-already-provided)
3. [How it works (30 seconds)](#3-how-it-works-30-seconds)
4. [Prerequisites](#4-prerequisites)
5. [Step 1 — Install](#5-step-1--install)
6. [Step 2 — Environment variables](#6-step-2--environment-variables)
7. [Step 3 — Wire up React](#7-step-3--wire-up-react)
8. [Step 4 — Sign up and sign in](#8-step-4--sign-up-and-sign-in)
9. [Step 5 — Transfer STX](#9-step-5--transfer-stx)
10. [Step 6 — Call your app contract](#10-step-6--call-your-app-contract)
11. [Vanilla TypeScript (no React)](#11-vanilla-typescript-no-react)
12. [Next.js notes](#12-nextjs-notes)
13. [Your app contract (Clarity)](#13-your-app-contract-clarity)
14. [Production checklist](#14-production-checklist)
15. [Troubleshooting](#15-troubleshooting)
16. [Quick reference](#16-quick-reference)

---

## 1. What you are responsible for

| You build | You do **not** run |
|-----------|-------------------|
| Your frontend (React, Next.js, Vue, etc.) | `passkey-account` / `passkey-adapter` deployment |
| Your app UI (buttons, flows, state) | Relay server (`@stacks-passkey/relay`) |
| Optional: your own Clarity app contract | Gas tank admin / sponsor key management |

You **do** need two values from whoever operates the infrastructure:

- **Relay URL** — e.g. `https://relay.yourplatform.com` or `http://localhost:8787` for local dev against a teammate's relay
- **Relay API key** — `spk_...` (pays gas for your users' transactions)

---

## 2. What is already provided

### Shared testnet contracts (use as-is for prototyping)

From [`config/testnet.json`](../config/testnet.json):

| Contract | ID |
|----------|-----|
| Factory | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-factory` |
| Adapter | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-adapter` |
| Demo app (example) | `ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app` |

Each user gets a **dedicated smart account** (e.g. `STxxx.passkey-acc-a1b2c3d4`) deployed by the relay on first sign-up. Fund that address — not a shared pool contract.

### npm packages

| Package | Purpose |
|---------|---------|
| `@stacks-passkey/core` | PasskeyClient, signing, `invoke()` |
| `@stacks-passkey/react` | `PasskeyProvider`, `usePasskeyAccount()` hooks |
| `@stacks/network` | `STACKS_TESTNET` |

---

## 3. How it works (30 seconds)

```
User (Face ID) → Your frontend → SDK → Relay (gas + account deploy) → per-user passkey-acc-* on-chain
```

1. User taps **Sign up** → WebAuthn creates a passkey in the device secure enclave.
2. SDK → relay `POST /v1/accounts/ensure` → relay deploys `passkey-acc-{hash}`, registers key + factory mapping.
3. Session stores **user's** `contractId` (e.g. `STxxx.passkey-acc-a1b2c3d4`).
4. User taps **Do something** → SDK asks for biometric approval, builds a signed transaction, relay broadcasts it.
5. For your app's custom logic, SDK calls `invoke('STxxx.your-app', 'your-function', args)` which routes through the adapter.

You never touch private keys. The relay cannot forge signatures — it only sponsors fees.

---

## 4. Prerequisites

- **Node.js ≥ 20**
- **Modern browser** with platform authenticator (Face ID, Touch ID, Windows Hello)
- **HTTPS or localhost** (WebAuthn requirement)
- **Relay URL + API key** from your infra provider
- For **transfers**: fund the user's smart account (`session.contractId`) with STX

---

## 5. Step 1 — Install

In your frontend project:

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

No separate CLI install — `spk` ships inside `@stacks-passkey/core` if you need it later.

---

## 6. Step 2 — Environment variables

Create `.env` (Vite) or `.env.local` (Next.js):

```env
# From your infra provider (NOT localhost in production)
VITE_RELAY_URL=https://relay.yourplatform.com
VITE_RELAY_API_KEY=spk_your_project_key_here

# Deployer address (copy from config/testnet.json)
VITE_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
VITE_FACTORY_NAME=passkey-factory

# Your app contract (after you deploy it — optional for invoke demos)
VITE_APP_CONTRACT_ID=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app
```

For **local dev** against a teammate's relay:

```env
VITE_RELAY_URL=http://localhost:8787
VITE_RELAY_API_KEY=spk_...
```

> **Security:** In production, do not ship `spk_...` keys in public frontend bundles. Proxy through your backend (see [Production checklist](#14-production-checklist)).

---

## 7. Step 3 — Wire up React

### Config module

Create `src/passkey-config.ts`:

```typescript
import { STACKS_TESTNET } from '@stacks/network';
import type { PasskeyProviderConfig } from '@stacks-passkey/react';

export function getPasskeyConfig(): PasskeyProviderConfig {
  const relayUrl = import.meta.env.VITE_RELAY_URL;
  const relayApiKey = import.meta.env.VITE_RELAY_API_KEY;

  if (!relayUrl || !relayApiKey) {
    throw new Error('Set VITE_RELAY_URL and VITE_RELAY_API_KEY');
  }

  return {
    network: STACKS_TESTNET,
    relayUrl,
    relayApiKey,
    deployerAddress: import.meta.env.VITE_DEPLOYER_ADDRESS ?? 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
    factoryName: import.meta.env.VITE_FACTORY_NAME ?? 'passkey-factory',
    rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    rpName: 'My dApp',
    origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
    fee: {
      mode: 'gasless',
      relayUrl,
      relayApiKey,
    },
  };
}
```

### Root provider

```tsx
// main.tsx or App.tsx
import { PasskeyProvider } from '@stacks-passkey/react';
import { getPasskeyConfig } from './passkey-config';

export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <PasskeyProvider config={getPasskeyConfig()}>
      {children}
    </PasskeyProvider>
  );
}
```

### Use hooks in your pages

```tsx
import { usePasskeyAccount } from '@stacks-passkey/react';

export function WalletSection() {
  const { session, isRegistered, loading, error, register, signIn, logout, transfer, invoke } =
    usePasskeyAccount();

  if (!isRegistered) {
    return (
      <div>
        <button disabled={loading} onClick={() => register(crypto.randomUUID(), 'User')}>
          Sign up with Passkey
        </button>
        <button disabled={loading} onClick={() => signIn()}>
          Sign in
        </button>
        {error && <p>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p>Signed in · key {session?.publicKeyHex.slice(0, 16)}…</p>
      <button onClick={() => logout()}>Log out</button>
    </div>
  );
}
```

Full working example: [`examples/demo/`](../examples/demo/).

---

## 8. Step 4 — Sign up and sign in

### Sign up (new user)

```tsx
const { register } = usePasskeyAccount();

async function handleSignUp() {
  const credential = await register(crypto.randomUUID(), displayName);
  console.log('Registered, txid:', credential.txid);
}
```

What happens:

1. Browser WebAuthn prompt (biometric)
2. SDK stores session in `localStorage`
3. SDK submits `register` to on-chain passkey-account via relay

### Sign in (returning user)

```tsx
const { signIn } = usePasskeyAccount();

async function handleSignIn() {
  const session = await signIn();
  console.log('Public key:', session.publicKeyHex);
}
```

Uses the passkey credential already stored on the device. No on-chain tx for sign-in alone.

---

## 9. Step 5 — Transfer STX

Transfers move STX from the **shared passkey-account contract** (not the user's personal STX address).

```tsx
const { transfer } = usePasskeyAccount();

async function sendStx() {
  const recipient = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const amountMicroStx = 1000n; // 1000 µSTX
  const txid = await transfer(recipient, amountMicroStx);
  console.log('Transfer txid:', txid);
}
```

Requirements:

- User must be signed in (`usePasskeyAccount().session` exists)
- Shared passkey-account contract must have enough STX
- Relay must accept the transaction (valid API key, gas tank funded)

---

## 10. Step 6 — Call your app contract

Use `invoke()` for custom on-chain logic (swap, mint, vote, set-score, etc.).

```tsx
const { invoke } = usePasskeyAccount();
const client = usePasskeyClient(); // for getOriginAddress()

async function setScore() {
  const appContract = import.meta.env.VITE_APP_CONTRACT_ID
    ?? 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app';

  const txid = await invoke(appContract, 'set-score', {
    arg0: 42n,                        // uint slot
    arg2: client.getOriginAddress(),  // principal slot (user)
  });
  console.log('Invoke txid:', txid);
}
```

### Invoke argument slots

| Slot | Type | Example |
|------|------|---------|
| `arg0`, `arg1` | `uint` | amounts, scores, token IDs |
| `arg2`, `arg3` | `principal` | user address, recipient |
| `arg4` | `buff` (bytes) | opaque payload |

Omitted slots default to safe empty values.

### Catalog registration (automatic)

`invoke()` calls the relay's `/v1/catalog/ensure` first. The relay registers your app contract on `passkey-adapter` if needed. You do **not** run registration yourself unless you want to pre-register:

```bash
npx spk ensure STxxx.your-app
# needs SPK_RELAY_URL + SPK_RELAY_API_KEY
```

---

## 11. Vanilla TypeScript (no React)

```typescript
import { PasskeyClient } from '@stacks-passkey/core';
import { hexToBytes } from '@stacks/common';
import { STACKS_TESTNET } from '@stacks/network';

const client = new PasskeyClient({
  network: STACKS_TESTNET,
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  deployerAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
  rpId: window.location.hostname,
  rpName: 'My dApp',
  origin: window.location.origin,
  fee: {
    mode: 'gasless',
    relayUrl: import.meta.env.VITE_RELAY_URL,
    relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  },
});

document.getElementById('signup')!.onclick = async () => {
  await client.register(crypto.randomUUID(), 'User');
};

document.getElementById('signin')!.onclick = async () => {
  await client.signIn();
};

document.getElementById('transfer')!.onclick = async () => {
  const session = client.getSession();
  if (!session) throw new Error('Sign in first');
  await client.executeAction(
    { type: 'transfer', recipient: 'ST...', amount: 1000n },
    hexToBytes(session.publicKeyHex),
    session.credentialId
  );
};

document.getElementById('invoke')!.onclick = async () => {
  await client.invoke('STxxx.your-app', 'your-function', { arg0: 1n });
};
```

---

## 12. Next.js notes

WebAuthn and `window` only exist in the browser.

1. Mark passkey components **`'use client'`**
2. Dynamically import or render passkey UI only after mount
3. Set `rpId` to your production domain (e.g. `app.example.com`)
4. Use `NEXT_PUBLIC_` prefix instead of `VITE_` for env vars

```tsx
'use client';

import { PasskeyProvider, usePasskeyAccount } from '@stacks-passkey/react';

// PasskeyProvider must wrap client components only
```

Do not call `register()` or `signIn()` in Server Components or during SSR.

---

## 13. Your app contract (Clarity)

If your dApp needs custom on-chain logic beyond transfer/key management, you deploy **one contract** — your app — that implements `passkey-exec`. You do **not** redeploy passkey-account or passkey-adapter.

Minimal pattern (copy from [`examples/demo/contracts/passkey-demo-app.clar`](../examples/demo/contracts/passkey-demo-app.clar)):

```clarity
(impl-trait .passkey-adapter.passkey-exec-trait)

(define-public (passkey-exec
    (function-name (string-ascii 128))
    (arg0 uint) (arg1 uint)
    (arg2 principal) (arg3 principal) (arg4 (buff 1024))
  )
  (begin
    (asserts! (is-eq function-name "my-action") ERR-UNKNOWN)
    ;; your logic
    (ok u1)
  )
)
```

Ask your platform operator to deploy it, or deploy to testnet yourself and share the contract ID with your frontend env (`VITE_APP_CONTRACT_ID`). The relay + SDK handle adapter registration.

For protocol details see [DEVELOPER_GUIDE.md § Phase 2](./DEVELOPER_GUIDE.md#6-phase-2--write-your-app-contract).

---

## 14. Production checklist

```
□ Get production relay URL + API key from platform operator
□ Use your production domain as rpId (must match WebAuthn)
□ Serve app over HTTPS
□ Proxy relay API key through your backend — never expose spk_... in client bundle
□ Set VITE_DEPLOYER_ADDRESS to your production deployer
□ Deploy your app contract; set VITE_APP_CONTRACT_ID
□ Test register → signIn → transfer → invoke on testnet first
□ Handle loading/error states in UI (usePasskeyAccount exposes both)
```

### Proxy pattern (recommended)

Your backend holds `spk_...` and forwards sponsor requests:

```
Browser → your-api.com/passkey/sponsor → relay → Stacks
```

Point SDK `relayUrl` at your proxy, not the raw relay. See [SDK.md § Production proxy](./SDK.md#production-proxy-relay-api-keys).

---

## 15. Troubleshooting

| Problem | Fix |
|---------|-----|
| WebAuthn not supported | Use HTTPS or localhost; check browser |
| `Invalid API key` | Verify `VITE_RELAY_API_KEY` with provider |
| `Relay URL` network error | Relay down or CORS — check provider status |
| Transfer fails | User's smart account (`session.contractId`) may have no STX — fund that address |
| Invoke fails `NOT-REGISTERED` | Relay missing adapter config, or app contract lacks `passkey-exec` |
| Account deploy fails | Relay missing `PASSKEY_FACTORY_ADDRESS` / gas tank balance |
| Sign-in works but tx fails | Stale session from old architecture — sign up again |

---

## 16. Quick reference

### Hooks (`@stacks-passkey/react`)

| Hook / method | Purpose |
|---------------|---------|
| `register(userId, userName)` | New user + on-chain key registration |
| `signIn()` | Returning user authentication |
| `logout()` | Clear local session |
| `transfer(recipient, amount)` | STX transfer from smart account |
| `invoke(contract, fn, args?)` | Call your app via adapter |
| `session` | `{ contractId, publicKeyHex, credentialId, ... }` — fund `session.contractId` |
| `loading` / `error` | UI state |

### Shared testnet constants (copy-paste)

```typescript
export const DEPLOYER = 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ';
export const PASSKEY_FACTORY_ID = 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-factory';
export const DEMO_APP_ID = 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app';
```

### Related docs

| Doc | When to read |
|-----|--------------|
| [GUIDE.md](./GUIDE.md) | **You are here** — frontend-only integration |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Deploy contracts, host relay, full stack |
| [SDK.md](./SDK.md) | API reference, types, relay endpoints |
| [examples/demo/](../examples/demo/) | Runnable reference app |

---

## Minimal copy-paste starter

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

```tsx
import { PasskeyProvider, usePasskeyAccount } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';

const config = {
  network: STACKS_TESTNET,
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  deployerAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
  rpId: window.location.hostname,
  rpName: 'My dApp',
  origin: window.location.origin,
  fee: {
    mode: 'gasless' as const,
    relayUrl: import.meta.env.VITE_RELAY_URL,
    relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  },
};

function PasskeyApp() {
  const { isRegistered, register, signIn, invoke } = usePasskeyAccount();
  if (!isRegistered) {
    return (
      <>
        <button onClick={() => register(crypto.randomUUID(), 'User')}>Sign up</button>
        <button onClick={() => signIn()}>Sign in</button>
      </>
    );
  }
  return (
    <button
      onClick={() =>
        invoke('ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app', 'set-score', {
          arg0: 10n,
          arg2: 'ST000000000000000000002AMW42H',
        })
      }
    >
      Set score
    </button>
  );
}

export default function App() {
  return (
    <PasskeyProvider config={config}>
      <PasskeyApp />
    </PasskeyProvider>
  );
}
```

Set `VITE_RELAY_URL` and `VITE_RELAY_API_KEY`, run on localhost, and you have a working passkey dApp frontend.
