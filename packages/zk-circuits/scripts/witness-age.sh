#!/usr/bin/env bash
# =============================================================================
# Generate a Groth16 witness for the `age_verification` circuit.
#
# Usage:
#   bash scripts/witness-age.sh
#
# Inputs:
#   ./input-age.json (see circuits/age_verification.circom for the layout)
#
# Outputs:
#   ./build/age_verification.wtns
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INPUT="${1:-input-age.json}"

if [[ ! -f "build/age_verification_js/age_verification.wasm" ]]; then
  echo "→ age_verification.wasm not found — running compile.sh"
  bash scripts/compile.sh
fi

if [[ ! -f "$INPUT" ]]; then
  echo "❌ $INPUT not found."
  echo "   Create one with: { dob_year, dob_month, dob_day, min_age, current_timestamp, dob_commitment }"
  exit 1
fi

echo "→ Generating witness for age_verification circuit"
snarkjs wtns calculate \
  build/age_verification_js/age_verification.wasm \
  "$INPUT" \
  build/age_verification.wtns

echo "✅ Witness written to build/age_verification.wtns"
