import { describe, it, expect, vi } from "vitest";
import { bytesToHex, hexToBytes, base64urlEncode, base64urlDecode } from "../src/utils/index.js";
import { strKeyToPubKey, pubKeyToStrKey } from "../src/utils/encoding.js";
import { isValidStrkey } from "../src/utils/_strkey.js";
import {
  isStellarPubKey,
  isStellarStrKey,
  isEvmAddress,
  isHash32,
} from "../src/utils/typeGuards.js";
import { retry } from "../src/utils/retry.js";
import { SSIError } from "../src/errors.js";
import { DEFAULT_TX_TIMEOUT_MS, EVM_CHAIN_ID, WRAPPED_ASSET_PREFIX } from "../src/constants.js";

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

describe("isValidStrkey", () => {
  it("returns true for valid round-tripped keys", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const addr = pubKeyToStrKey(bytes);
    expect(isValidStrkey(addr)).toBe(true);
  });

  it("returns false for wrong-length addresses", () => {
    expect(isValidStrkey("G" + "A".repeat(10))).toBe(false);
    expect(isValidStrkey("GA")).toBe(false);
  });

  it("returns false for non-G prefix", () => {
    expect(isValidStrkey("A" + "B".repeat(55))).toBe(false);
    expect(isValidStrkey("M" + "A".repeat(55))).toBe(false);
  });

  it("returns false for tampered addresses", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const addr = pubKeyToStrKey(bytes);
    const tampered = addr.slice(0, 10) + "Q" + addr.slice(11);
    expect(isValidStrkey(tampered)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidStrkey("")).toBe(false);
  });

  it("returns false for invalid base32 chars", () => {
    // '0' and '1' are not in the Crockford base32 alphabet
    expect(isValidStrkey("G000000000000000000000000000000000000000000000000000000")).toBe(false);
  });
});

describe("errors", () => {
  it("errors carry a stable code", () => {
    const e = new SSIError("X", "y");
    expect(e.code).toBe("X");
  });
});

describe("constants", () => {
  it("declares well-known chain ids", () => {
    expect(EVM_CHAIN_ID.polygonAmoy).toBe(80002);
    expect(EVM_CHAIN_ID.ethereum).toBe(1);
  });

  it("uses 'WID' as the wrapped-asset prefix", () => {
    expect(WRAPPED_ASSET_PREFIX).toBe("WID");
  });

  it("has a sane default tx timeout", () => {
    expect(DEFAULT_TX_TIMEOUT_MS).toBeGreaterThan(1_000);
  });
});

describe("typeGuards", () => {
  it("isStellarPubKey accepts 32-byte Uint8Array", () => {
    expect(isStellarPubKey(new Uint8Array(32))).toBe(true);
    expect(isStellarPubKey(new Uint8Array(16))).toBe(false);
    expect(isStellarPubKey("not bytes")).toBe(false);
  });

  it("isStellarStrKey matches 'G…' shape only", () => {
    expect(isStellarStrKey("G" + "A".repeat(55))).toBe(true);
    expect(isStellarStrKey("G" + "A".repeat(10))).toBe(false);
    expect(isStellarStrKey("0xabc")).toBe(false);
  });

  it("isEvmAddress accepts canonical 0x… form", () => {
    expect(isEvmAddress("0x" + "a".repeat(40))).toBe(true);
    expect(isEvmAddress("0x" + "Z".repeat(40))).toBe(false);
    expect(isEvmAddress("not hex")).toBe(false);
  });

  it("isHash32 accepts 0x + 64 hex chars", () => {
    expect(isHash32("0x" + "0".repeat(64))).toBe(true);
    expect(isHash32("0x" + "0".repeat(63))).toBe(false);
  });
});

describe("retry", () => {
  it("returns the first successful result", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      return 42;
    });
    expect(result).toBe(42);
    expect(calls).toBe(1);
  });

  it("retries up to maxAttempts times before throwing", async () => {
    let calls = 0;
    await expect(
      retry(
        async () => {
          calls++;
          throw new Error("boom");
        },
        { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1 },
      ),
    ).rejects.toThrow("boom");
    expect(calls).toBe(3);
  });

  it("calls onRetry on every retry attempt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const onRetry = vi.fn();
    await expect(
      retry(fn, { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1, onRetry }),
    ).rejects.toThrow("x");
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("throws immediately when shouldRetry returns false", async () => {
    let calls = 0;
    await expect(
      retry(
        async () => {
          calls++;
          throw new Error("permanent");
        },
        { maxAttempts: 5, initialDelayMs: 1, maxDelayMs: 1, shouldRetry: () => false },
      ),
    ).rejects.toThrow("permanent");
    expect(calls).toBe(1);
  });
});
