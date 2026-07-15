#!/usr/bin/env bash
# =============================================================================
# CI pre-test step for ZK circuits.
# Compiles Circom circuits and runs the Groth16 trusted setup when circom
# is available and artifacts are missing. Skips gracefully if:
#   - circom is not installed (local dev without full toolchain)
#   - artifacts already exist (restored from CI cache)
#   - the powers-of-tau download fails (network-restricted runner)
#
# Called from the `pretest` npm script in package.json.
# =============================================================================
set -euo pipefail

if ! command -v circom >/dev/null 2>&1; then
  echo "circom not available — ZK tests will skip (install via scripts/install-circom.sh)"
  exit 0
fi

# If cached artifacts exist (restored by CI cache), skip recompilation.
if [[ -f "build/credential_js/credential.wasm" && -f "keys/credential_final.zkey" ]]; then
  echo "ZK artifacts found in cache — skipping compilation"
  exit 0
fi

echo "→ Compiling ZK circuits..."
bash scripts/compile.sh

echo "→ Running trusted setup..."
# If the PTAU download fails (network-restricted CI runner, S3 outage),
# the tests will skip gracefully just like when artifacts are missing.
if ! bash scripts/setup.sh; then
  echo "⚠️  Trusted setup failed (PTAU download or snarkjs error) — ZK tests will skip"
  exit 0
fi

echo "✅ ZK artifacts ready — tests will run with real proofs"
