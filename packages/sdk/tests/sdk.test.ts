import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { SSIError, ChainConnectionError, ZKProofError } from "../src/errors.js";
import { DEFAULT_TX_TIMEOUT_MS, EVM_CHAIN_ID, WRAPPED_ASSET_PREFIX } from "../src/constants.js";

// ============================================================================
// Existing utility tests (encoding, strkey, errors, constants, typeGuards, retry)
// ============================================================================

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
    expect(isValidStrkey("G000000000000000000000000000000000000000000000000000000")).toBe(false);
  });
});

describe("errors", () => {
  it("errors carry a stable code", () => {
    const e = new SSIError("X", "y");
    expect(e.code).toBe("X");
  });

  it("ChainConnectionError has proper name", () => {
    const e = new ChainConnectionError("stellar", "http://localhost:8000");
    expect(e.name).toBe("ChainConnectionError");
    expect(e.message).toContain("stellar");
  });

  it("ZKProofError has proper name", () => {
    const e = new ZKProofError("bad proof");
    expect(e.name).toBe("ZKProofError");
    expect(e.code).toBe("ZK_PROOF_ERROR");
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

// ============================================================================
// Stellar client tests
// ============================================================================

const MOCK_IDENTITY_RECORD = {
  pubkey: new Uint8Array(32),
  biometric_commitment: new Uint8Array(32),
  metadata_cid: "QmTest123",
  recovery_owners: [new Uint8Array(32)],
  created_at: 1_000_000,
  updated_at: 1_000_000,
};

vi.mock("@stellar/stellar-sdk", () => {
  const simulateTx = vi.fn().mockResolvedValue({
    result: { retval: { type: "vec", value: [] } },
  });
  const sendTx = vi.fn().mockResolvedValue({
    status: "PENDING",
    hash: "mock_send_hash",
  });

  const mockRpcServer = vi.fn(() => ({
    getAccount: vi.fn().mockResolvedValue({
      id: () => "G",
      sequenceNumber: () => "0",
    }),
    simulateTransaction: simulateTx,
    prepareTransaction: vi.fn().mockImplementation((tx) => {
      tx.sign = vi.fn();
      return Promise.resolve(tx);
    }),
    sendTransaction: sendTx,
    getTransaction: vi.fn().mockResolvedValue({
      status: "SUCCESS",
    }),
  }));

  return {
    Keypair: Object.assign(
      vi.fn(() => ({
        publicKey: () => "GDummyStellarPublicKeyXXXXXXXXXXXXXXXXXXXXXXXXXX",
      })),
      {
        fromSecret: vi.fn(() => ({
          publicKey: () => "GDummyStellarPublicKeyXXXXXXXXXXXXXXXXXXXXXXXXXX",
        })),
      },
    ),
    Address: {
      fromString: vi.fn(() => ({
        toScVal: () => ({ type: "address", value: "dummy" }),
      })),
    },
    Contract: vi.fn(() => ({
      call: vi.fn(() => ({ type: "operation" })),
    })),
    Account: vi.fn(() => ({
      accountId: () => "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      sequenceNumber: () => "0",
    })),
    TransactionBuilder: vi.fn(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn(() => ({
        hash: () => "mock_tx_hash",
        toEnvelope: () => "AAAA",
        sign: vi.fn(),
      })),
    })),
    BASE_FEE: "100",
    Horizon: { Server: vi.fn() },
    SorobanRpc: { Server: mockRpcServer },
    nativeToScVal: vi.fn((val: unknown) => val),
    scValToNative: vi.fn((val: { type: string; value: unknown } | null) => {
      if (!val) return null;
      if (Array.isArray(val.value) && (val.value as unknown[]).length === 0) return null;
      return val.value ?? val;
    }),
  };
});

import { SSIStellar } from "../src/stellar/index.js";

const STELLAR_CONFIG = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  identityContractId: "CA3D5K7RKFQ2JX7Z6Y5K4L3M2N1P0Q9R8S7T6U5V4W3X2Y1Z",
  wrappedBadgeContractId: "CB7X6Y5Z4W3V2U1T0S9R8Q7P6O5N4M3L2K1J0I9H8G7F6E5D4C3B2A1",
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
};

describe("SSIStellar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates instance with valid config", () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      expect(client.config.horizonUrl).toBe("https://horizon-testnet.stellar.org");
      expect(client.identity).toBeDefined();
      expect(client.wrappedBadge).toBeDefined();
      expect(client.credentials).toBeDefined();
    });

    it("throws ChainConnectionError when horizonUrl is missing", () => {
      expect(() => new SSIStellar({ ...STELLAR_CONFIG, horizonUrl: "" })).toThrow(
        ChainConnectionError,
      );
    });
  });

  describe("submitTransaction", () => {
    it("submits signed XDR and returns hash on success", async () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      const hash = await client.submitTransaction("AAAA");
      expect(hash).toBe("mock_send_hash");
    });

    it("throws on non-PENDING status", async () => {
      // Mock sendTransaction to return an error before creating the client
      const mockSdk = await import("@stellar/stellar-sdk");
      const rpcConstructor = vi.mocked(mockSdk.SorobanRpc.Server);
      // The factory shares sendTransaction — but the mock RPC constructor creates
      // a fresh instance. We need to override it by setting up a custom constructor.
      rpcConstructor.mockImplementationOnce(() => ({
        getAccount: vi.fn(),
        simulateTransaction: vi.fn(),
        prepareTransaction: vi.fn(),
        sendTransaction: vi.fn().mockResolvedValue({
          status: "ERROR",
          error: "bad nonce",
        }),
        getTransaction: vi.fn(),
      }));

      const client = new SSIStellar(STELLAR_CONFIG);
      await expect(client.submitTransaction("AAAA")).rejects.toThrow(/submission failed/);
    });
  });

  describe("identity", () => {
    it("returns null when identity not found (no retval)", async () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      const result = await client.identity.get(new Uint8Array(32));
      expect(result).toBeNull();
    });

    it("returns populated identity record on success", async () => {
      const mockSdk = await import("@stellar/stellar-sdk");
      const rpcConstructor = vi.mocked(mockSdk.SorobanRpc.Server);
      rpcConstructor.mockImplementationOnce(() => ({
        getAccount: vi.fn(),
        simulateTransaction: vi.fn().mockResolvedValue({
          result: { retval: { type: "vec", value: MOCK_IDENTITY_RECORD } },
        }),
        prepareTransaction: vi.fn(),
        sendTransaction: vi.fn(),
        getTransaction: vi.fn(),
      }));

      const client = new SSIStellar(STELLAR_CONFIG);
      const result = await client.identity.get(new Uint8Array(32));
      expect(result).not.toBeNull();
      expect(result!.pubkey).toBeInstanceOf(Uint8Array);
      expect(result!.metadataCid).toBe("QmTest123");
      expect(result!.recoveryOwners).toHaveLength(1);
    });

    it("creates identity and returns tx hash on success", async () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      const hash = await client.identity.create({
        pubkey: new Uint8Array(32),
        biometricCommitment: new Uint8Array(32),
        metadataCid: "QmTestCreate",
        recoveryOwners: [new Uint8Array(32)],
        signerSecret: "SBCVMMCBEDSO4XLZQKP5Y7AT3R6OQ6Z5KX2Y7AT3R6OQ6Z5KX2Y7AT3R",
      });
      expect(hash).toBe("mock_send_hash");
    });
  });

  describe("wrappedBadge", () => {
    it("returns null when badge not found", async () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      const result = await client.wrappedBadge.get(new Uint8Array(32), 80002, new Uint8Array(32));
      expect(result).toBeNull();
    });
  });

  describe("credentials", () => {
    it("returns empty when no contractId configured", async () => {
      const client = new SSIStellar({
        ...STELLAR_CONFIG,
        identityContractId: "",
      });
      const result = await client.credentials.list(new Uint8Array(32));
      expect(result).toEqual([]);
    });

    it("returns empty when simulation returns no results", async () => {
      const client = new SSIStellar(STELLAR_CONFIG);
      const result = await client.credentials.list(new Uint8Array(32));
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// EVM client tests
// ============================================================================

const mockReadContract = vi.fn();

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  http: vi.fn(() => "mock_transport"),
  createWalletClient: vi.fn(),
  custom: vi.fn(),
}));

import { SSIEvm } from "../src/evm/index.js";

const EVM_CONFIG = {
  rpcUrl: "https://polygon-amoy.g.alchemy.com/v2/demo",
  chainId: 80002,
  contracts: {
    registry: "0x1111111111111111111111111111111111111111" as const,
    sbt: "0x2222222222222222222222222222222222222222" as const,
    bridge: "0x3333333333333333333333333333333333333333" as const,
  },
};

describe("SSIEvm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates instance with valid config", () => {
      const client = new SSIEvm(EVM_CONFIG);
      expect(client.config.rpcUrl).toBe("https://polygon-amoy.g.alchemy.com/v2/demo");
      expect(client.registry).toBeDefined();
      expect(client.sbt).toBeDefined();
      expect(client.bridge).toBeDefined();
    });

    it("throws ChainConnectionError without rpcUrl", () => {
      expect(() => new SSIEvm({ ...EVM_CONFIG, rpcUrl: "" })).toThrow(ChainConnectionError);
    });
  });

  describe("registry sub-client", () => {
    it("isIssuer returns boolean", async () => {
      mockReadContract.mockResolvedValue(true);
      const client = new SSIEvm(EVM_CONFIG);
      const result = await client.registry.isIssuer("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(result).toBe(true);
    });

    it("isSchema returns boolean", async () => {
      mockReadContract.mockResolvedValue(false);
      const client = new SSIEvm(EVM_CONFIG);
      const result = await client.registry.isSchema(("0x" + "b".repeat(64)) as `0x${string}`);
      expect(result).toBe(false);
    });
  });

  describe("sbt sub-client", () => {
    it("balanceOf returns bigint", async () => {
      mockReadContract.mockResolvedValue(3n);
      const client = new SSIEvm(EVM_CONFIG);
      const result = await client.sbt.balanceOf("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(result).toBe(3n);
    });

    it("ownerOf returns address", async () => {
      mockReadContract.mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      const client = new SSIEvm(EVM_CONFIG);
      const result = await client.sbt.ownerOf(1n);
      expect(result).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    });
  });

  describe("bridge sub-client", () => {
    it("isProcessed returns boolean", async () => {
      mockReadContract.mockResolvedValue(true);
      const client = new SSIEvm(EVM_CONFIG);
      const result = await client.bridge.isProcessed(("0x" + "c".repeat(64)) as `0x${string}`);
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// ZKP client tests
// ============================================================================

vi.mock("snarkjs", () => ({
  groth16: {
    fullProve: vi.fn().mockResolvedValue({
      proof: {
        pi_a: ["1", "2"],
        pi_b: [
          ["3", "4"],
          ["5", "6"],
        ],
        pi_c: ["7", "8"],
        protocol: "groth16",
        curve: "bn128",
      },
      publicSignals: ["pub1", "pub2"],
    }),
    verify: vi.fn().mockResolvedValue(true),
  },
}));

import { SSIZkp } from "../src/zkp/index.js";

describe("SSIZkp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("prove", () => {
    it("generates proof and public signals", async () => {
      const zkp = new SSIZkp();
      const result = await zkp.prove({
        wasm: "/path/to/circuit.wasm",
        zkey: "/path/to/proving_key.zkey",
        input: { age: 25 },
      });
      expect(result.proof).toBeDefined();
      expect(result.proof.protocol).toBe("groth16");
      expect(result.publicSignals).toContain("pub1");
    });

    it("throws ZKProofError on failure", async () => {
      const mockSnarkjs = await import("snarkjs");
      vi.mocked(mockSnarkjs.groth16.fullProve).mockRejectedValueOnce(new Error("bad wasm"));
      const zkp = new SSIZkp();
      await expect(
        zkp.prove({ wasm: "/bad/path.wasm", zkey: "/bad/key.zkey", input: {} }),
      ).rejects.toThrow(ZKProofError);
    });
  });

  describe("verify", () => {
    it("returns true for valid proof", async () => {
      const zkp = new SSIZkp();
      const result = await zkp.verify({ vk: "dummy" }, ["pub1"], {
        pi_a: ["1"],
        pi_b: [["2"], ["3"]],
        pi_c: ["4"],
        protocol: "groth16",
        curve: "bn128",
      });
      expect(result).toBe(true);
    });

    it("returns false for invalid proof", async () => {
      const mockSnarkjs = await import("snarkjs");
      vi.mocked(mockSnarkjs.groth16.verify).mockResolvedValueOnce(false);
      const zkp = new SSIZkp();
      const result = await zkp.verify({ vk: "dummy" }, ["pub1"], {
        pi_a: ["1"],
        pi_b: [["2"], ["3"]],
        pi_c: ["4"],
        protocol: "groth16",
        curve: "bn128",
      });
      expect(result).toBe(false);
    });
  });
});
