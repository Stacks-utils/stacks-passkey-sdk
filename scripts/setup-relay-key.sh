#!/usr/bin/env bash
# Create a restricted sponsor key file for the relay.
# Usage: ./scripts/setup-relay-key.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYFILE="$ROOT/packages/relay/sponsor.key"

echo "Paste sponsor private key (hex, input hidden):"
read -rs KEY
echo

if [[ ! "$KEY" =~ ^[0-9a-fA-F]{64}(01)?$ ]]; then
  echo "Invalid key format" >&2
  exit 1
fi

printf '%s' "$KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"
echo "Wrote $KEYFILE (mode 600)"
echo "Point SPONSOR_PRIVATE_KEY_FILE at this path in packages/relay/.env"
