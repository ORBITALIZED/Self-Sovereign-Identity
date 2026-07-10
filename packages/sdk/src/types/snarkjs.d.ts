/**
 * Minimal type declarations for snarkjs (v0.7.x).
 * Full type definitions are not shipped by the package itself.
 */
declare module "snarkjs" {
  export namespace groth16 {
    interface Groth16Proof {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
      protocol: string;
      curve: string;
    }

    function fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(vKey: unknown, publicSignals: string[], proof: Groth16Proof): Promise<boolean>;
  }
}
