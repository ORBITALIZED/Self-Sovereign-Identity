import { describe, it, expect } from "vitest";
import { bytesToHex, hexToBytes, base64urlEncode, base64urlDecode } from "../src/utils/index.js";
import { strKeyToPubKey, pubKeyToStrKey } from "../src/utils/encoding.js";
import { SSIError } from "../src/errors.js";

describe("utils/encoding", () => {
  it("round-trips bytes through hex", () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it("round-trips bytes through base64url", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
  });
});

describe("strKey encode/decode", () => {
  it("round-trips random 32-byte keys", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const addr = pubKeyToStrKey(bytes);
    expect(addr).toMatch(/^G[A-Z2-7]{55}$/);
    expect(addr.length).toBe(56);
    const decoded = strKeyToPubKey(addr);
    expect(decoded).toEqual(bytes);
  });

  it("rejects addresses with wrong length", () => {
    expect(() => strKeyToPubKey("G" + "A".repeat(10))).toThrow();
    expect(() => strKeyToPubKey("GA")).toThrow();
  });

  it("rejects addresses starting with non-G", () => {
    expect(() => strKeyToPubKey("A" + "B".repeat(55))).toThrow(/invalid Stellar address/);
  });

  it("rejects tampered addresses (bad CRC)", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const addr = pubKeyToStrKey(bytes);
    // Flip one char in the body to corrupt it
    const tampered = addr.slice(0, 10) + "Q" + addr.slice(11);
    expect(() => strKeyToPubKey(tampered)).toThrow(/CRC16 checksum mismatch/);
  });

  it("produces deterministic output for the same input", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    expect(pubKeyToStrKey(bytes)).toBe(pubKeyToStrKey(bytes));
  });

  it("rejects wrong-length keys in encode", () => {
    expect(() => pubKeyToStrKey(new Uint8Array(31))).toThrow(/expected 32-byte/);
    expect(() => pubKeyToStrKey(new Uint8Array(33))).toThrow(/expected 32-byte/);
  });
});

describe("errors", () => {
  it("errors carry a stable code", () => {
    const e = new SSIError("X", "y");
    expect(e.code).toBe("X");
  });
});
