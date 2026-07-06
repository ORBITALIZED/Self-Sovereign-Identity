/**
 * Encoding helpers used throughout the SDK.
 *  - Stellar public keys ↔ raw bytes
 *  - base64url for IPFS / authenticated payloads
 *  - sha256 (via globalThis.crypto.subtle, browser + Node 20+)
 */

import type { Hash32, StellarPubKey } from "../types/index.js";

import { decodeStrkey } from "./_strkey.js";

// Stellar "G…" addresses MUST contain a valid 32-byte ed25519 public key + CRC16.
// In real code we should parse & verify the checksum; for the scaffold we lazy-
// import a tiny decoder stub so callers don't have to reach into the heavier
// stellar-base library at SDK load time.
export function strKeyToPubKey(gAddress: string): StellarPubKey {
  return decodeStrkey(gAddress);
}

export function pubKeyToStrKey(pk: StellarPubKey): string {
  // Placeholder inverse of strKeyToPubKey — to be replaced.
  return "G".padEnd(56, "A");
}

export function bytesToHex(b: Uint8Array): Hash32 {
  return ("0x" +
    Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as Hash32;
}

export function hexToBytes(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    out[i / 2] = parseInt(s.slice(i, i + 2), 16);
  }
  return out;
}

export function base64urlEncode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}

export function base64urlDecode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

export async function sha256(b: Uint8Array): Promise<Hash32> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", b);
  return bytesToHex(new Uint8Array(hash));
}
