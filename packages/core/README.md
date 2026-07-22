# @stacks-passkey/core

TypeScript SDK for wallet-less passkey smart accounts on Stacks.

## Install

```bash
npm install @stacks-passkey/core @stacks/network
```

## Documentation

**Full integration guide:** [docs/SDK.md](../../docs/SDK.md)

Covers configuration, registration, sign-in, actions, fee modes, relay setup, React integration, production deployment, and API reference.

## Quick start

```typescript
import { PasskeyClient } from '@stacks-passkey/core';
import { STACKS_TESTNET } from '@stacks/network';

const client = new PasskeyClient({
  network: STACKS_TESTNET,
  relayUrl: 'http://localhost:8787',
  relayApiKey: 'spk_...',
  contractAddress: 'SP...',
  contractName: 'passkey-account-v3',
  rpId: 'localhost',
  rpName: 'My App',
  origin: 'http://localhost:3000',
});

await client.register('user-id', 'Alice');
const session = await client.signIn();
```

## License

MIT
