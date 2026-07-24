# @stacks-passkey/core

TypeScript SDK for wallet-less passkey smart accounts on Stacks.

[![npm version](https://img.shields.io/npm/v/@stacks-passkey/core)](https://www.npmjs.com/package/@stacks-passkey/core)

## Install

```bash
npm install @stacks-passkey/core @stacks/network
```

Includes the **`spk` CLI** (`npx spk help`).

Related packages: [`@stacks-passkey/react`](https://www.npmjs.com/package/@stacks-passkey/react) · [`@stacks-passkey/relay`](https://www.npmjs.com/package/@stacks-passkey/relay)

## Documentation

| Guide | Audience |
|-------|----------|
| [docs/GUIDE.md](../../docs/GUIDE.md) | Frontend dApp devs — SDK only |
| [docs/DEVELOPER_GUIDE.md](../../docs/DEVELOPER_GUIDE.md) | Full stack — deploy + relay |
| [docs/SDK.md](../../docs/SDK.md) | API reference |

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

await client.register('user-id', 'Alice');
const session = await client.signIn();
await client.invoke('STxxx.my-app', 'set-score', { arg0: 42n, arg2: client.getOriginAddress() });
```

Shared testnet deployment IDs are in [`config/testnet.json`](../../config/testnet.json).

## CLI

```bash
npx spk init [dir]              # scaffold passkey.manifest.json
npx spk ensure STxxx.my-app     # POST /v1/catalog/ensure (needs SPK_RELAY_API_KEY)
```

## License

MIT
