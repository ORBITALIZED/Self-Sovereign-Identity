import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "stellar/index": "src/stellar/index.ts",
    "evm/index":     "src/evm/index.ts",
    "zkp/index":     "src/zkp/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: ["@stellar/stellar-sdk", "viem", "snarkjs"],
});
