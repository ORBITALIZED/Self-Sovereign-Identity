/**
 * Zero-knowledge helpers — generate and verify Groth16 proofs using snarkjs.
 */

import { ZKProofError } from "../errors.js";

let _snarkjs: typeof import("snarkjs") | undefined;

async function snarkjs() {
  if (!_snarkjs) _snarkjs = await import("snarkjs");
  return _snarkjs;
}

export interface ZKInputs {
  wasm:  string;            // path to .wasm
  zkey:  string;            // path to .zkey
  input: Record<string, unknown>;
}

export interface ZKProof {
  pi_a:      string[];
  pi_b:      string[][];
  pi_c:      string[];
  protocol:  string;
  curve:     string;
}

export class SSIZkp {
  async prove({ wasm, zkey, input }: ZKInputs): Promise<{ proof: ZKProof; publicSignals: string[] }> {
    try {
      const s = await snarkjs();
      return await s.groth16.fullProve(input, wasm, zkey);
    } catch (e) {
      throw new ZKProofError((e as Error).message);
    }
  }

  async verify(vKeyJson: object, publicSignals: string[], proof: ZKProof): Promise<boolean> {
    const s = await snarkjs();
    return s.groth16.verify(vKeyJson, publicSignals, proof);
  }
}
