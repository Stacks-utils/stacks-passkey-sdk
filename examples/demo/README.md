# Stacks Passkey Portal

Unified web portal at **http://localhost:3000** — demo, developer docs, and dev portal in one app.

## SDK on npm

Install the published packages in your own app (v0.1.0):

```bash
npm install @stacks-passkey/core @stacks-passkey/react @stacks/network
```

- [@stacks-passkey/core](https://www.npmjs.com/package/@stacks-passkey/core)
- [@stacks-passkey/react](https://www.npmjs.com/package/@stacks-passkey/react)
- [@stacks-passkey/relay](https://www.npmjs.com/package/@stacks-passkey/relay) (self-hosted relay)

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing page |
| `/demo` | Interactive SDK demo (passkey smart account, transfers, invoke) |
| `/docs` | Developer documentation (redirects to first topic) |
| `/docs/:topic` | Individual doc pages (e.g. `/docs/overview`, `/docs/invoke`) |
| `/portal` | Dev portal — API keys, gas tanks, sponsorship logs |

## Quick start

```bash
# From repo root
npm run dev:relay
npm run dev:demo    # or: npm run dev:portal
```

## Environment (`examples/demo/.env`)

```env
VITE_RELAY_URL=https://stacks-passkey-relay.onrender.com
VITE_RELAY_API_KEY=spk_...
VITE_RELAY_ADMIN_API_KEY=admin-dev-change-me
VITE_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
```

The legacy `examples/relay-admin/` package is kept for reference; use this portal instead.
