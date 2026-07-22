# Relay security

The sponsor private key controls a wallet that pays transaction fees. Treat it like a hot wallet with a spending limit.

## Critical rules

1. **Never commit secrets** — do not put private keys in git, chat, CI logs, or shell history.
2. **Use a dedicated sponsor wallet** — not your contract deployer or treasury key. Fund it with only enough STX for sponsorship.
3. **Prefer `SPONSOR_PRIVATE_KEY_FILE`** — store the key in a file with `chmod 600`, not inline env vars.
4. **Require `RELAY_API_KEY`** — every `/sponsor` request must authenticate unless `RELAY_ALLOW_INSECURE_LOCAL=true` (local dev only).
5. **Bind to localhost in dev** — default `HOST=127.0.0.1`. Expose publicly only behind TLS + auth + rate limits.
6. **Rotate if exposed** — if a key appeared in logs, chat, or terminal history, move funds and use a new sponsor wallet.

## Setup (recommended)

```bash
cd stackspasskey
cp packages/relay/.env.example packages/relay/.env
# Edit RELAY_API_KEY to a long random string

chmod +x scripts/setup-relay-key.sh
./scripts/setup-relay-key.sh   # writes packages/relay/sponsor.key (mode 600)

npm run dev:relay
```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SPONSOR_PRIVATE_KEY_FILE` | Yes (prod) | Path to chmod 600 key file |
| `RELAY_API_KEY` | Yes (prod) | Bearer token for `/sponsor` |
| `ALLOWED_CONTRACTS` | Recommended | Restrict which contracts can be called |
| `MAX_FEE_MICRO_STX` | Recommended | Cap fee per sponsored tx |
| `HOST` | Recommended | Default `127.0.0.1` |
| `SPONSOR_PRIVATE_KEY` | Dev only | Blocked when `NODE_ENV=production` |

## Client configuration

The SDK must send the API key when configured:

```typescript
new PasskeyClient({
  relayUrl: 'https://relay.yourapp.com',
  relayApiKey: process.env.RELAY_API_KEY, // server-side proxy recommended
  // ...
});
```

**Best practice:** do not embed `RELAY_API_KEY` in frontend bundles. Proxy sponsor requests through your backend.

## Clarinet deployer keys

`contracts/settings/Testnet.toml` may contain deploy mnemonics. Prefer:

```bash
cd contracts && clarinet deployments encrypt
```

Never reuse the deployer key as the relay sponsor key.
