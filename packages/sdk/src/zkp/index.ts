/**
 * Zero-knowledge helpers — generate and verify Groth16 proofs using snarkjs.
 */

import { ZKProofError } from "../errors.js";

let _snarkjs: typeof import("snarkjs") | undefined;

async function snarkjs() {
  if (!_snarkjs) _snarkjs = await import("snarkjs");
  return _snarkjs;
}

/** Inputs to {@link SSIZkp.prove}: file paths plus the circuit input map. */
export interface ZKInputs {
  /** Filesystem path to the `.wasm` produced by `circom --wasm`. */
  wasm: string;
  /** Filesystem path to the proving key produced by the trusted-setup ceremony. */
  zkey: string;
  /** JSON-serialisable map of circuit input signals. */
  input: Record<string, unknown>;
}

/** A canonical Groth16 proof in snarkjs JSON shape. */
export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

/**
 * Thin wrapper around the `snarkjs` package — both `groth16.fullProve`
 * for proving and `groth16.verify` for on-chain or off-chain checks.
 *
 * `snarkjs` is lazily loaded on first use to keep the SDK bundle small
 * and to allow environments without a snarkjs install to import the
 * rest of the SDK without throwing.
 */
export class SSIZkp {
  /**
   * Generate a Groth16 proof for the given inputs. Returns the proof
   * plus the public signals extracted from the witness.
   *
   * @throws ZKProofError if snarkjs throws (bad inputs, wrong wasm/zkey, etc).
   */
  async prove({
    wasm,
    zkey,
    input,
  }: ZKInputs): Promise<{ proof: ZKProof; publicSignals: string[] }> {
    try {
      const s = await snarkjs();
      return await s.groth16.fullProve(input, wasm, zkey);
    } catch (e) {
      throw new ZKProofError((e as Error).message);
    }
  }

  /**
   * Verify a Groth16 proof against a verification key. Returns true if
   * the proof is valid for the given public signals.
   */
  async verify(vKeyJson: object, publicSignals: string[], proof: ZKProof): Promise<boolean> {
    const s = await snarkjs();
    return s.groth16.verify(vKeyJson, publicSignals, proof);
  }
}
