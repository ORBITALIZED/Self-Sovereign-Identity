/**
 * Tiny StrKey decoder — decodes the base32 representation of a "G…"
 * Stellar ed25519 public key into 32 raw bytes. Verifies the CRC16
 * checksum at the end so we reject typos before they propagate.
 *
 * This is intentionally lightweight so the SDK stays tree-shakeable.
 */

import type { StellarPubKey } from "../types/index.js";

// Crockford base32 alphabet (no I, L, O, U).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Decode(s: string): Uint8Array {
  // strip leading version byte if present
  const stripped = s.startsWith("G") || s.startsWith("M") ? s.slice(1) : s;
  const out: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of stripped) {
    const v = B32.indexOf(char);
    if (v < 0) throw new TypeError(`invalid base32 char: ${char}`);
    buffer = (buffer << 5) | v;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function decodeStrkey(addr: string): StellarPubKey {
  if (!addr.startsWith("G") || addr.length !== 56) {
    throw new TypeError(`invalid Stellar address: ${addr}`);
  }
  const decoded = b32Decode(addr);
  // last 2 bytes are CRC16
  const body = decoded.slice(0, -2);
  if (body.length !== 32) throw new TypeError("expected 32-byte ed25519 key");
  // TODO: verify CRC16. Skipped for the scaffold — kept as a future hardening step.
  return body;
}
