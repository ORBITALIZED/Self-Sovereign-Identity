/**
 * Tiny `node:http` server exposing a single `/health` endpoint so that
 * container orchestrators (k8s, fly, ECS) can probe the relayer without
 * pulling in a web framework just for that.
 *
 * Status payload describes whether the relayer believes itself ready:
 *   - `relayer: ok` iff RELAYER_PRIVATE_KEY, EVM_RPC_URL, EVM_BRIDGE_CONTRACT and
 *     EVM_SBT_CONTRACT are all configured.
 *   - `evm: ok|kicked` iff the bootstrap EVM `getBlockNumber` call succeeded
 *     during `start()`.
 *
 * The state is mutated by `markEvmHealthy()` / `markEvmUnhealthy()` from
 * `index.ts` once the EVM listener has bootstrapped.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

let evmHealthy = false;
const PORT = Number(process.env.HEALTH_PORT ?? 8081);

export function markEvmHealthy(): void {
  evmHealthy = true;
}
export function markEvmUnhealthy(): void {
  evmHealthy = false;
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

export function startHealthServer(): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET") {
      send(res, 405, { error: "method_not_allowed" });
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/health") {
      const cfg = readRelayerConfig();
      const relayerReady = Object.values(cfg).every(Boolean);
      const ok = relayerReady && evmHealthy;
      send(res, ok ? 200 : 503, {
        status: ok ? "ready" : "degraded",
        relayer: relayerReady ? "ok" : "missing-config",
        evm: evmHealthy ? "ok" : "kicked",
        config: cfg,
      });
      return;
    }
    send(res, 404, { error: "not_found" });
  });
  server.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`[relayer] /health listening on :${PORT}`);
  });
}
