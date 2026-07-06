#!/usr/bin/env bash
# =============================================================================
# Compile every circuit in ./circuits/ into ./build/
# Requires `circom` on PATH (install via scripts/install-circom.sh).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v circom >/dev/null 2>&1; then
  echo "❌ circom not found — run scripts/install-circom.sh"
  exit 1
fi

mkdir -p build keys

for circuit in circuits/*.circom; do
  name=$(basename "$circuit" .circom)
  echo "→ Compiling $name"
  circom "$circuit" \
    --r1cs --wasm --sym \
    -o build \
    -l node_modules
done

echo "✅ Compiled. Artifacts in ./build/"
