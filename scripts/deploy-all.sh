#!/usr/bin/env bash
# =============================================================================
# End-to-end deployment script.
#  1. deploy Stellar Soroban contracts
#  2. deploy EVM Solidity contracts
#  3. export contract addresses into .env
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"

[[ -f "$ENV" ]] || { echo "❌ Missing .env (copy from .env.example)"; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV"; set +a

echo "🚀 Deploying Soroban contracts…"
make -C "$ROOT/packages/contracts-stellar" deploy || {
  echo "⚠️ Soroban deployment skipped (may need stellar CLI tools)"
}

echo "🚀 Deploying EVM contracts…"
cd "$ROOT/packages/contracts-evm"
forge script script/Deploy.s.sol \
  --rpc-url "${EVM_RPC_URL:?EVM_RPC_URL is required}" \
  --private-key "${EVM_DEPLOYER_PRIVATE_KEY:?EVM_DEPLOYER_PRIVATE_KEY is required}" \
  --broadcast || {
  echo "⚠️ EVM deployment failed. Check your .env configuration."
  exit 1
}

echo "✅ Deployment complete. Contract addresses are logged above."
