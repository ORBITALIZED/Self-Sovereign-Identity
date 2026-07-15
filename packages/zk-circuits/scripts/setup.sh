#!/usr/bin/env bash
# =============================================================================
# Download a small powers-of-tau file (or generate one), then run a Phase-2
# contribution for every compiled circuit. DEV ONLY — production needs a
# proper multi-party trusted setup ceremony.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p keys

PTAU=pot17_final.ptau
if [[ ! -f "$PTAU" ]]; then
  echo "→ Downloading powers-of-tau (17) — dev only"
  curl -L -o "$PTAU" \
    https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_17.ptau
fi

# Use pnpm exec to resolve the local snarkjs from the workspace node_modules.
SNARKJS="pnpm exec snarkjs"

for r1cs in build/*.r1cs; do
  name=$(basename "$r1cs" .r1cs)
  echo "→ Trusted setup for $name"
  $SNARKJS groth16 setup "$r1cs" "$PTAU" "keys/${name}_0000.zkey"
  $SNARKJS zkey contribute \
    "keys/${name}_0000.zkey" \
    "keys/${name}_final.zkey" \
    --name="SSI dev contribution" -v -e="$(openssl rand -hex 32)"
  $SNARKJS zkey export verificationkey \
    "keys/${name}_final.zkey" \
    "keys/${name}_vkey.json"
done

echo "✅ Keys in ./keys/"
