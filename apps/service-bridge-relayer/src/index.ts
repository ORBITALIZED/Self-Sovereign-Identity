/**
 * Bridge relayer entry point.
 * Boots:
 *   • State persistence (crash-safe, idempotent event processing)
 *   • Stellar Horizon listener  (cron-style polling every 5 s)
 *   • EVM JSON-RPC listener    (websocket subscription)
 *   • Tiny /health server for orchestrator probes
 */

import pino from "pino";
import { startStellarListener } from "./listeners/stellar.js";
import { startEvmListener } from "./listeners/evm.js";
import { startHorizonStream } from "./horizon/client.js";
import { startHealthServer, markEvmHealthy } from "./health.js";
import { RelayerStateManager } from "./state.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main() {
  log.info("🌉 SSI bridge relayer starting…");

  // Load persisted state for crash recovery.
  const state = new RelayerStateManager();
  await state.load();

  startHealthServer();
  startStellarListener();
  await startHorizonStream();

  // Pass the state manager to the EVM listener for idempotent operation.
  startEvmListener(state)
    .then(() => markEvmHealthy())
    .catch((err) => log.error({ err }, "EVM listener failed to boot"));

  log.info("✅ Relayer running");

  // Graceful shutdown: flush state before exit.
  const shutdown = async () => {
    log.info("🛑 shutting down, flushing state…");
    await state.flush();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
