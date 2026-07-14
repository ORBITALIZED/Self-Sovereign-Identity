import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "stellar/index": "src/stellar/index.ts",
    "evm/index": "src/evm/index.ts",
    "zkp/index": "src/zkp/index.ts",
    // The `utils` re-export entry was added so consumers can do
    // `@ssi/sdk/utils`. tsup with `splitting: false` emits it as a
    // single bundled file per format, matching the package.json `exports`.
    "utils/index": "src/utils/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  // `splitting: false` ensures each entry produces a single fully-bundled
  // file in each format. With `splitting: true`, tsup can emit a single
  // ESM bundle that imports shared chunks *without* accompanying CJS
  // chunks, which leaves the CJS bundle missing — that breaks Vitest
  // resolution when the package.json `exports` map demands `.mjs`.
  splitting: false,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Explicit per-format extension: ESM → `.mjs`, CJS → `.js`. This makes
  // the package.json `exports.import` / `exports.require` paths resolve
  // unambiguously without relying on package.json `"type"`.
  outExtension({ format }) {
    return { js: format === "esm" ? ".mjs" : ".cjs" };
  },
  external: ["@stellar/stellar-sdk", "viem", "snarkjs"],
});
