#!/usr/bin/env bash
# =============================================================================
# Install a specific version of `circom` from source.
# Used by the bootstrap script; safe to re-run.
# =============================================================================
set -euo pipefail

VERSION="${1:-2.1.6}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log() { printf "\033[0;34m[install-circom]\033[0m %s\n" "$*"; }
log "Cloning circom v${VERSION}…"
git clone --depth 1 --branch "v${VERSION}" https://github.com/iden3/circom.git "$WORK/circom"
cd "$WORK/circom"
cargo build --release
mkdir -p "$HOME/.local/bin"
cp target/release/circom "$HOME/.local/bin/circom"
echo "circom $("$HOME/.local/bin/circom" --version) installed to $HOME/.local/bin/"
