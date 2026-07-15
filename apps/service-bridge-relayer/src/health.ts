/**
 * Tiny `node:http` server exposing health, dead-letter inspection, and retry
 * endpoints so container orchestrators (k8s, fly, ECS) can probe and operate
 * the relayer without pulling in a web framework.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { RelayerStateManager } from "./state.js";

let evmHealthy = false;
let stateRef: RelayerStateManager | null = null;
const PORT = Number(process.env.HEALTH_PORT ?? 8081);

export function markEvmHealthy(): void {
  evmHealthy = true;
}
export function markEvmUnhealthy(): void {
  evmHealthy = false;
}

/** Register the state manager so the health server can expose dead-letter stats. */
export function registerStateManager(state: RelayerStateManager | null): void {
  stateRef = state;
}

function readRelayerConfig() {
  return {
    relayer: !!process.env.RELAYER_PRIVATE_KEY,
    rpc: !!process.env.EVM_RPC_URL,
    bridge: !!process.env.EVM_BRIDGE_CONTRACT,
    sbt: !!process.env.EVM_SBT_CONTRACT,
  };
}

function send(res: ServerResponse, code: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

export function startHealthServer(port?: number): Server {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/health") {
      if (req.method !== "GET") {
        send(res, 405, { error: "method_not_allowed" });
        return;
      }
      const cfg = readRelayerConfig();
      const relayerReady = Object.values(cfg).every(Boolean);
      const ok = relayerReady && evmHealthy;
      send(res, ok ? 200 : 503, {
        status: ok ? "ready" : "degraded",
        relayer: relayerReady ? "ok" : "missing-config",
        evm: evmHealthy ? "ok" : "kicked",
        config: cfg,
        deadLetters: stateRef?.getDeadLetterCount() ?? 0,
        processed: stateRef?.getProcessedCount() ?? 0,
        lastBlock: stateRef?.getLastBlock().toString() ?? "0",
      });
      return;
    }
    if (url.pathname === "/dead-letters") {
      if (req.method !== "GET") {
        send(res, 405, { error: "method_not_allowed" });
        return;
      }
      if (!stateRef) {
        send(res, 503, { error: "state_not_initialized" });
        return;
      }
      send(res, 200, {
        count: stateRef.getDeadLetterCount(),
        items: stateRef.getDeadLetters(),
      });
      return;
    }
    if (url.pathname === "/dead-letters/retry") {
      if (req.method !== "POST") {
        send(res, 405, { error: "method_not_allowed" });
        return;
      }
      if (!stateRef) {
        send(res, 503, { error: "state_not_initialized" });
        return;
      }
      const raw = url.searchParams.get("id");
      if (!raw) {
        send(res, 400, { error: "missing_id_param" });
        return;
      }
      const okRetry = stateRef.retryDeadLetter(raw);
      send(res, okRetry ? 200 : 404, {
        retried: okRetry,
        id: raw,
      });
      return;
    }
    send(res, 404, { error: "not_found" });
  });
  server.listen(port ?? PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`[relayer] /health listening on :${port ?? PORT}`);
  });
  return server;
}
