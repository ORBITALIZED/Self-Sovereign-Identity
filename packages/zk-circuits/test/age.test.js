/*
 * Smoke test for the compiled `age_verification` circuit.
 * Requires that the circuit is already built (`bash scripts/compile.sh`)
 * and Phase-2 setup is complete (`bash scripts/setup.sh`).
 */
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const wasm = path.join(root, "build", "age_verification_js", "age_verification.wasm");
  const zkey = path.join(root, "keys", "age_verification_final.zkey");
  const input = JSON.parse(fs.readFileSync(path.join(root, "input-age.json"), "utf8"));

  if (!fs.existsSync(wasm) || !fs.existsSync(zkey)) {
    console.warn("⚠️  Missing artifacts — run `pnpm compile && pnpm setup` first.");
    return;
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  const vKey = JSON.parse(
    fs.readFileSync(path.join(root, "keys", "age_verification_vkey.json"), "utf8"),
  );
  const ok = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.log("Age verification proof verified:", ok);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
