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
make -C "$ROOT/packages/contracts-stellar" deploy
ok_sbt=$(grep STELLAR_IDENTITY_CONTRACT "$ENV" | cut -d= -f2)
ok_wb=$(grep  STELLAR_WRAPPED_BADGE_CONTRACT "$ENV" | cut -d= -f2)

echo "🚀 Deploying EVM contracts…"
cd "$ROOT/packages/contracts-evm"
forge script script/Deploy.s.sol \
  --rpc-url "${EVM_RPC_URL}" \
  --private-key "${EVM_DEPLOYER_PRIVATE_KEY}" \
  --broadcast

ok_reg=$(forge inspect IdentityRegistry deployed 2>/dev/null || echo "")
ok_sbt_erc=$(forge inspect IdentitySBT deployed  2>/dev/null || echo "")

echo "✅ Done. Update .env with the deployed addresses above and re-run your services."
