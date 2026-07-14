/**
 * Bridge relayer entry point.
 * Boots:
 *   • Stellar Horizon listener  (cron-style polling every 5 s)
 *   • EVM JSON-RPC listener    (websocket subscription)
 *   • Tiny /health server for orchestrator probes
 */

import pino from "pino";
import { startStellarListener } from "./listeners/stellar.js";
import { startEvmListener } from "./listeners/evm.js";
import { startHorizonStream } from "./horizon/client.js";
import { startHealthServer, markEvmHealthy } from "./health.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main() {
  log.info("🌉 SSI bridge relayer starting…");

  startHealthServer();
  startStellarListener();
  await startHorizonStream();
  // The EVM listener runs forever; signal readiness once it has the first block number.
  startEvmListener()
    .then(() => markEvmHealthy())
    .catch((err) => log.error({ err }, "EVM listener failed to boot"));

  log.info("✅ Relayer running");
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
