/*
 * Tiny smoke test for the compiled `credential` circuit.
 * Requires that the circuit is already built (`bash scripts/compile.sh`)
 * and Phase-2 setup is complete (`bash scripts/setup.sh`).
 */
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const wasm = path.join(root, "build", "credential_js", "credential.wasm");
  const zkey = path.join(root, "keys", "credential_final.zkey");
  const input = JSON.parse(fs.readFileSync(path.join(root, "input.json"), "utf8"));

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    console.warn("⚠️  Missing artifacts — run `pnpm compile && pnpm setup` first.");
    return;
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  const vKey = JSON.parse(fs.readFileSync(path.join(root, "keys", "credential_vkey.json"), "utf8"));
  const ok = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.log("Proof verified:", ok);
}

/** Nullifier reuse: proving twice with the same nullifier should be
 *  caught by the circuit (public nullifier_hash must be unique per
 *  proof — the circuit constraints enforce this). */
async function testNullifierReuse() {
  const root = path.resolve(__dirname, "..");
  const wasm = path.join(root, "build", "credential_js", "credential.wasm");
  const zkey = path.join(root, "keys", "credential_final.zkey");
  const input = JSON.parse(fs.readFileSync(path.join(root, "input.json"), "utf8"));

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    console.warn("⚠️  Missing artifacts for nullifier-reuse test");
    return;
  }

  // First proof should succeed.
  await snarkjs.groth16.fullProve(input, wasm, zkey);

  // Second proof with the SAME nullifier should fail — the circuit
  // constraint prevents nullifier reuse.
  try {
    await snarkjs.groth16.fullProve(input, wasm, zkey);
    console.error("FAIL: nullifier reuse was not rejected");
    process.exit(1);
  } catch {
    console.log("✅ Nullifier reuse correctly rejected");
  }
}

/** Invalid Merkle proof: tampering a path element should cause
 *  verification to fail because the root won't match. */
async function testInvalidMerkleProof() {
  const root = path.resolve(__dirname, "..");
  const wasm = path.join(root, "build", "credential_js", "credential.wasm");
  const zkey = path.join(root, "keys", "credential_final.zkey");
  const input = JSON.parse(fs.readFileSync(path.join(root, "input.json"), "utf8"));

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    console.warn("⚠️  Missing artifacts for invalid-Merkle-proof test");
    return;
  }

  // Tamper with a path element
  const tampered = { ...input, pathElements: [...input.pathElements] };
  tampered.pathElements[0] = "1"; // change first element

  try {
    await snarkjs.groth16.fullProve(tampered, wasm, zkey);
    console.error("FAIL: invalid Merkle proof was not rejected");
    process.exit(1);
  } catch {
    console.log("✅ Invalid Merkle proof correctly rejected");
  }
}

// Run edge cases after the main smoke test
main()
  .then(() => testNullifierReuse())
  .then(() => testInvalidMerkleProof())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
