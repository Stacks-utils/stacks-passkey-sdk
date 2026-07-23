#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Checking core contracts"
cd "$ROOT/contracts"
clarinet check -d

echo "==> Deploying passkey-factory (adapter/demo may already exist on testnet)"
echo Y | clarinet deployments apply -p deployments/factory.testnet-plan.yaml --no-dashboard

echo "==> Deploying demo app (passkey-demo-app)"
echo Y | clarinet deployments apply -p deployments/demo-app.testnet-plan.yaml --no-dashboard

echo "==> Done. Update config/testnet.json txids from clarinet output."
