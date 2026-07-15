/**
 * Unit tests for the health server — validates per-endpoint method enforcement,
 * status code correctness, and state manager integration for all three endpoints:
 * /health, /dead-letters, and /dead-letters/retry.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { Server } from "node:http";
import {
  startHealthServer,
  markEvmHealthy,
  markEvmUnhealthy,
  registerStateManager,
} from "../src/health.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

/** Minimal stub of RelayerStateManager — no filesystem, pure in-memory. */
function createStubStateManager(
  overrides: Partial<{
    deadLetterCount: number;
    processedCount: number;
    lastBlock: bigint;
    deadLetters: string[];
    retryResult: boolean;
  }> = {},
) {
  const {
    deadLetterCount = 0,
    processedCount = 42,
    lastBlock = 12345n,
    deadLetters = [] as string[],
    retryResult = true,
  } = overrides;
  return {
    getDeadLetterCount: () => deadLetterCount,
    getProcessedCount: () => processedCount,
    getLastBlock: () => lastBlock,
    getDeadLetters: () => [...deadLetters],
    retryDeadLetter: (_id: string) => retryResult,
  };
}

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, options);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Suite setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Ensure required env vars are set so config reads as "ready".
  vi.stubEnv(
    "RELAYER_PRIVATE_KEY",
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  );
  vi.stubEnv("EVM_RPC_URL", "http://localhost:8545");
  vi.stubEnv("EVM_BRIDGE_CONTRACT", "0x0000000000000000000000000000000000000000");
  vi.stubEnv("EVM_SBT_CONTRACT", "0x0000000000000000000000000000000000000000");

  // Port 0 lets the OS assign a free port — avoids conflicts in CI.
  server = startHealthServer(0);
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("failed to get port");
  baseUrl = `http://localhost:${addr.port}`;
});

// Ensure every test starts from a known-good baseline.
beforeEach(() => {
  markEvmHealthy();
  registerStateManager(createStubStateManager() as any);
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

// =========================================================================
// /health
// =========================================================================

describe("GET /health", () => {
  it("returns 200 and ready status when config is present and EVM is healthy", async () => {
    const { status, body } = await fetchJson("/health");
    expect(status).toBe(200);
    expect((body as any).status).toBe("ready");
    expect((body as any).config).toEqual({
      relayer: true,
      rpc: true,
      bridge: true,
      sbt: true,
    });
  });

  it("returns 503 when EVM is unhealthy", async () => {
    markEvmUnhealthy();

    const { status, body } = await fetchJson("/health");
    expect(status).toBe(503);
    expect((body as any).status).toBe("degraded");
    expect((body as any).evm).toBe("kicked");
  });

  it("includes dead-letter and processed counts from state manager", async () => {
    const { body } = await fetchJson("/health");
    expect((body as any).deadLetters).toBe(0);
    expect((body as any).processed).toBe(42);
    expect((body as any).lastBlock).toBe("12345");
  });
});

describe("method validation — /health", () => {
  const nonGetMethods = ["POST", "PUT", "DELETE", "PATCH"] as const;
  for (const method of nonGetMethods) {
    it(`rejects ${method} with 405`, async () => {
      const { status, body } = await fetchJson("/health", { method });
      expect(status).toBe(405);
      expect((body as any).error).toBe("method_not_allowed");
    });
  }
});

// =========================================================================
// /dead-letters
// =========================================================================

describe("GET /dead-letters", () => {
  it("returns 200 with count and items when state is registered", async () => {
    const { status, body } = await fetchJson("/dead-letters");
    expect(status).toBe(200);
    expect((body as any).count).toBe(0);
    expect(Array.isArray((body as any).items)).toBe(true);
  });

  it("returns actual dead-letter items from state manager", async () => {
    const stubState = createStubStateManager({
      deadLetterCount: 3,
      deadLetters: ["evt-1", "evt-2", "evt-3"],
    });
    registerStateManager(stubState as any);

    const { status, body } = await fetchJson("/dead-letters");
    expect(status).toBe(200);
    expect((body as any).count).toBe(3);
    expect((body as any).items).toEqual(["evt-1", "evt-2", "evt-3"]);
  });

  it("returns 503 when state manager is not registered", async () => {
    registerStateManager(null as any);
    const { status, body } = await fetchJson("/dead-letters");
    expect(status).toBe(503);
    expect((body as any).error).toBe("state_not_initialized");
  });
});

describe("method validation — /dead-letters", () => {
  const nonGetMethods = ["POST", "PUT", "DELETE", "PATCH"] as const;
  for (const method of nonGetMethods) {
    it(`rejects ${method} with 405`, async () => {
      const { status, body } = await fetchJson("/dead-letters", { method });
      expect(status).toBe(405);
      expect((body as any).error).toBe("method_not_allowed");
    });
  }
});

// =========================================================================
// /dead-letters/retry
// =========================================================================

describe("POST /dead-letters/retry", () => {
  it("returns 200 when retry succeeds", async () => {
    const { status, body } = await fetchJson("/dead-letters/retry?id=evt-1", { method: "POST" });
    expect(status).toBe(200);
    expect((body as any).retried).toBe(true);
    expect((body as any).id).toBe("evt-1");
  });

  it("returns 404 when the dead-letter id is not found", async () => {
    const stubState = createStubStateManager({ retryResult: false });
    registerStateManager(stubState as any);

    const { status, body } = await fetchJson("/dead-letters/retry?id=nonexistent", {
      method: "POST",
    });
    expect(status).toBe(404);
    expect((body as any).retried).toBe(false);
    expect((body as any).id).toBe("nonexistent");
  });

  it("returns 400 when id query param is missing", async () => {
    const { status, body } = await fetchJson("/dead-letters/retry", { method: "POST" });
    expect(status).toBe(400);
    expect((body as any).error).toBe("missing_id_param");
  });

  it("returns 503 when state manager is not registered", async () => {
    registerStateManager(null as any);
    const { status, body } = await fetchJson("/dead-letters/retry?id=evt-1", { method: "POST" });
    expect(status).toBe(503);
    expect((body as any).error).toBe("state_not_initialized");
  });
});

describe("method validation — /dead-letters/retry", () => {
  const nonPostMethods = ["GET", "PUT", "DELETE", "PATCH"] as const;
  for (const method of nonPostMethods) {
    it(`rejects ${method} with 405`, async () => {
      const { status, body } = await fetchJson("/dead-letters/retry?id=evt-1", { method });
      expect(status).toBe(405);
      expect((body as any).error).toBe("method_not_allowed");
    });
  }
});

// =========================================================================
// Unknown paths
// =========================================================================

describe("unknown paths", () => {
  it("returns 404 for GET on unknown path", async () => {
    const { status, body } = await fetchJson("/nonexistent");
    expect(status).toBe(404);
    expect((body as any).error).toBe("not_found");
  });

  it("returns 404 for POST on unknown path", async () => {
    const { status, body } = await fetchJson("/nonexistent", { method: "POST" });
    expect(status).toBe(404);
    expect((body as any).error).toBe("not_found");
  });
});
