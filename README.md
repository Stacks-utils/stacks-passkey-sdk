# Stacks Passkey SDK

Wallet-less, seedless onboarding for Stacks — biometric smart accounts with gasless transactions via Clarity 5 **secp256r1** passkeys.

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

---

## Documentation

**Full SDK integration guide for Stacks projects:**

### → [docs/SDK.md](docs/SDK.md)

Covers step-by-step integration, contract deployment, relay setup, fee modes, React/Next.js examples, production deployment, API reference, and troubleshooting.

Additional references:

| Doc | Description |
|-----|-------------|
| [docs/SDK.md](docs/SDK.md) | **Complete developer guide** — start here |
| [packages/relay/SECURITY.md](packages/relay/SECURITY.md) | Relay sponsor key security |
| [examples/demo/](examples/demo/) | Working demo app |
| [examples/relay-admin/](examples/relay-admin/) | API key & gas tank admin |

---

## What you get

| Package | Description |
|---------|-------------|
| `@stacks-passkey/core` | TypeScript SDK — WebAuthn, signing, sessions, relay client |
| `@stacks-passkey/react` | React hooks (`PasskeyProvider`, `usePasskeyAccount`) |
| `@stacks-passkey/relay` | Self-hostable sponsored transaction relay |
| `contracts/` | Clarity 5 smart contracts |

---

## 5-minute example

```typescript
import { PasskeyClient } from '@stacks-passkey/core';
import { hexToBytes } from '@stacks/common';
import { STACKS_TESTNET } from '@stacks/network';

const client = new PasskeyClient({
  network: STACKS_TESTNET,
  relayUrl: 'http://localhost:8787',
  relayApiKey: 'spk_...',
  contractAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
  contractName: 'passkey-account-v3',
  rpId: 'localhost',
  rpName: 'My App',
  origin: 'http://localhost:3000',
  fee: { mode: 'gasless', relayUrl: 'http://localhost:8787', relayApiKey: 'spk_...' },
});

// Sign up (Face ID / Touch ID)
await client.register(crypto.randomUUID(), 'Alice');

// Sign in (returning user)
const session = await client.signIn();

// Transfer STX from smart account
await client.executeAction(
  { type: 'transfer', recipient: 'ST...', amount: 1_000_000n },
  hexToBytes(session.publicKeyHex),
  session.credentialId
);
```

See [docs/SDK.md](docs/SDK.md) for the full walkthrough.

---

## Architecture

```
Browser (WebAuthn) → @stacks-passkey/core → Relay (sponsors gas) → passkey-account.clar
```

- **Non-custodial** — passkey keys never leave the device enclave
- **Relay** — pays gas only; cannot forge signatures
- **Fee modes** — `gasless` (your gas tank) or `account-pay` (user's contract STX)

---

## Local development

```bash
git clone <repo> && cd stackspasskey
npm install && npm run build

cp packages/relay/.env.example packages/relay/.env
./scripts/setup-relay-key.sh
npm run dev:relay    # :8787

cp examples/demo/.env.example examples/demo/.env
npm run dev:demo     # :3000

npm run dev:admin    # :3001 (optional)
```

---

## Testing

```bash
npm run test              # contracts + core + relay + e2e
npm run test:contracts
npm run test:unit
npm run test:e2e
```

---

## Requirements

- Node.js ≥ 20
- Clarity 5 / Epoch 3.4+ (correct WebAuthn verification)
- HTTPS or localhost (WebAuthn)
- Modern browser with platform authenticator

---

## License

MIT
