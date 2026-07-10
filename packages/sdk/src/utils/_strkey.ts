/**
 * Tiny StrKey encoder/decoder — bidirectional conversion between
 * Stellar "G…" addresses and 32 raw bytes.
 *
 * Uses Crockford base32 and CRC16-XMODEM, matching the Stellar strkey
 * specification. Intentionally lightweight so the SDK stays tree-shakeable.
 */

import type { StellarPubKey } from "../types/index.js";

// Crockford base32 alphabet (no I, L, O, U).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Build a reverse lookup map from char → index for O(1) decoding. */
const B32_REV: Record<string, number> = {};
for (let i = 0; i < B32.length; i++) B32_REV[B32[i]] = i;

// ---------------------------------------------------------------------------
// Base32
// ---------------------------------------------------------------------------

function b32Decode(s: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of s) {
    const v = B32_REV[char];
    if (v === undefined) throw new TypeError(`invalid base32 char: ${char}`);
    buffer = (buffer << 5) | v;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function b32Encode(bytes: Uint8Array): string {
  const chars: string[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      chars.push(B32[(buffer >> bitsLeft) & 0x1f]);
    }
  }
  // Flush remaining bits (pad with zeros)
  if (bitsLeft > 0) {
    chars.push(B32[(buffer << (5 - bitsLeft)) & 0x1f]);
  }
  return chars.join("");
}

// ---------------------------------------------------------------------------
// CRC16-XMODEM
// ---------------------------------------------------------------------------

/** CRC16-XMODEM table (polynomial 0x1021). Pre-computed for speed. */
const CRC_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >> 8) ^ b) & 0xff]) & 0xffff;
  }
  return crc;
}

// ---------------------------------------------------------------------------
// Stellar strkey
// ---------------------------------------------------------------------------

/**
 * Base32-decode a "G…" Stellar ed25519 public key into 32 raw bytes.
 * Strips the leading version-indicator character, decodes the remaining
 * 55 base32 chars, and verifies the CRC16 checksum in the last 2 bytes.
 */
export function decodeStrkey(addr: string): StellarPubKey {
  if (!addr.startsWith("G") || addr.length !== 56) {
    throw new TypeError(`invalid Stellar address: ${addr}`);
  }
  // Strip the version-indicator prefix ("G" for ed25519 public key)
  const encoded = addr.slice(1);
  const decoded = b32Decode(encoded);
  // decoded has 34 bytes: 32 key bytes + 2 CRC16 bytes
  const body = decoded.slice(0, -2);
  const checksum = decoded.slice(-2);

  if (body.length !== 32) throw new TypeError("expected 32-byte ed25519 key");

  // Verify CRC16 checksum
  const expectedCrc = crc16(body);
  const actualCrc = (checksum[0] << 8) | checksum[1];
  if (expectedCrc !== actualCrc) {
    throw new TypeError("CRC16 checksum mismatch — invalid address");
  }

  return body;
}

/**
 * Encode 32 raw ed25519 bytes into a "G…" Stellar address (56 chars).
 * Prepends the version byte (0x30 → base32 'G'), computes CRC16-XMODEM
 * over the key bytes, appends the 2-byte checksum, and base32-encodes
 * the whole payload.
 */
export function encodeStrkey(pk: Uint8Array): string {
  if (pk.length !== 32) {
    throw new TypeError(`expected 32-byte key, got ${pk.length}`);
  }

  // Stellar strkey payload: 32 key bytes + 2 CRC16 bytes = 34 bytes
  const checksum = crc16(pk);
  const payload = new Uint8Array(34);
  payload.set(pk, 0);
  payload[32] = (checksum >> 8) & 0xff;
  payload[33] = checksum & 0xff;

  // Base32-encode the 34-byte payload → 55 chars, prepend 'G'
  return "G" + b32Encode(payload);
}
