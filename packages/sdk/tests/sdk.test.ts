import { describe, it, expect } from "vitest";
import { bytesToHex, hexToBytes, base64urlEncode, base64urlDecode } from "../src/utils/index.js";
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

describe("errors", () => {
  it("errors carry a stable code", () => {
    const e = new SSIError("X", "y");
    expect(e.code).toBe("X");
  });
});
