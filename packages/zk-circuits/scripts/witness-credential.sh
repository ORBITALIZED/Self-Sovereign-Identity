#!/usr/bin/env bash
# =============================================================================
# Generate a Groth16 witness for the `credential` circuit.
#
# Usage:
#   bash scripts/witness-credential.sh
#
# Inputs:
#   ./input.json (see README for the expected schema)
#
# Outputs:
#   ./build/credential.wtns
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Compile circuits if the wasm/proof artifacts are missing.
if [[ ! -f "build/credential_js/credential.wasm" ]]; then
  echo "→ credential.wasm not found — running compile.sh"
  bash scripts/compile.sh
fi

echo "→ Generating witness for credential circuit"
snarkjs wtns calculate \
  build/credential_js/credential.wasm \
  input.json \
  build/credential.wtns

echo "✅ Witness written to build/credential.wtns"
