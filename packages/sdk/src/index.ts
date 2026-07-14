/**
 * @ssi/sdk — top-level public API.
 *
 * The SDK is organised by domain:
 *
 *   @ssi/sdk/stellar  → Stellar / Soroban integration
 *   @ssi/sdk/evm      → EVM (Polygon / Ethereum) integration
 *   @ssi/sdk/zkp      → Zero-knowledge proving / verification
 */

export * from "./stellar/index.js";
export * from "./evm/index.js";
export * from "./zkp/index.js";
export * from "./types/index.js";
export * from "./constants.js";
export * from "./utils/encoding.js";
export * from "./utils/typeGuards.js";
export * from "./utils/retry.js";
export { decodeStrkey, encodeStrkey, isValidStrkey } from "./utils/_strkey.js";
export * as Errors from "./errors.js";
