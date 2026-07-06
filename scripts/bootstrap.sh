#!/usr/bin/env bash
# =============================================================================
# Bootstrap the local development environment for the SSI platform.
# Intended to be called by `make bootstrap` (kept idempotent).
# =============================================================================
set -euo pipefail

log() { printf "\033[0;34m[bootstrap]\033[0m %s\n" "$*"; }
ok()  { printf "\033[0;32m[bootstrap]\033[0m %s\n" "$*"; }
warn(){ printf "\033[0;33m[bootstrap]\033[0m %s\n" "$*"; }

log "Installing JS deps via pnpm…"
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi
pnpm install

log "Installing Rust toolchain (1.79.0)…"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.79.0
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi
rustup target add wasm32-unknown-unknown --toolchain 1.79.0

log "Installing Foundry…"
if ! command -v forge >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
fi

log "Installing OpenZeppelin + forge-std (for Foundry)..."
(cd packages/contracts-evm && {
  [[ -d lib/openzeppelin-contracts ]] || forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
  [[ -d lib/forge-std ]]             || forge install foundry-rs/forge-std@v1.1.0 --no-commit
})

log "Installing Circom (2.1.6)…"
bash "$(dirname "$0")/install-circom.sh" 2.1.6

ok "Bootstrap complete."
