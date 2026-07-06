/**
 * Bridge relayer entry point.
 * Boots:
 *   • Stellar Horizon listener  (cron-style polling every 5 s)
 *   • EVM JSON-RPC listener    (websocket subscription)
 */

import pino from "pino";
import { startStellarListener } from "./listeners/stellar.js";
import { startEvmListener }     from "./listeners/evm.js";
import { startHorizonStream }   from "./horizon/client.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main() {
  log.info("🌉 SSI bridge relayer starting…");

  startStellarListener();
  await startHorizonStream();
  await startEvmListener();

  log.info("✅ Relayer running");
}

main().catch((err) => { log.error(err); process.exit(1); });
