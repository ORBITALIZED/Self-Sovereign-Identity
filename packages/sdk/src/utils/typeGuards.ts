/**
 * Runtime type guards used at SDK boundaries (HTTP, Soroban RPC, EVM
 * logs) to validate inputs before they hit call sites that assume
 * well-formed values.
 */

import type { EvmAddress } from "../types/index.js";

const EV_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const STELLAR_STRKEY = /^G[A-Z2-7]{55}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const STELLAR_PUBKEY_LEN = 32;

/** True if the input is a 32-byte Uint8Array — i.e. a valid StellarPubKey shape. */
export function isStellarPubKey(x: unknown): x is Uint8Array {
  return x instanceof Uint8Array && x.length === STELLAR_PUBKEY_LEN;
}

/** True if the input is a 56-character `G…` strkey address (no checksum enforced). */
export function isStellarStrKey(x: unknown): x is string {
  return typeof x === "string" && STELLAR_STRKEY.test(x);
}

/** True if the input is a lowercase `0x`-prefixed 20-byte hex string. */
export function isEvmAddress(x: unknown): x is EvmAddress {
  return typeof x === "string" && EV_ADDRESS.test(x);
}

/** True if the input is a `0x`-prefixed 32-byte hex string. */
export function isHash32(x: unknown): x is `0x${string}` {
  return typeof x === "string" && HASH32.test(x);
}
