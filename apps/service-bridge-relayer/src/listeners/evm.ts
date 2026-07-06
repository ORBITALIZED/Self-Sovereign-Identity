/**
 * EVM-side listener: subscribes to `BadgeLocked` events emitted by the
 * `WrappedBadge` contract. For each event:
 *   1. Query the AI fraud service for a score on `(issuer, holder)`.
 *   2. Submit a `wrap_badge` invocation to Soroban (via SDK).
 */

import { createPublicClient, http, parseAbi } from "viem";
import { setTimeout as wait } from "node:timers/promises";

const ABI = parseAbi([
  "event BadgeLocked(address indexed holder, bytes32 indexed schemaHash, uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
]);

export async function startEvmListener() {
  const client = createPublicClient({
    transport: http(process.env.EVM_RPC_URL),
  });

  // Subscribe via websocket — falls back to polling every 12 blocks.
  // Polling scaffold for now (WS subscription needs an authenticated WS endpoint).
  let lastBlock = await client.getBlockNumber();

  while (true) {
    const current = await client.getBlockNumber();
    if (current <= lastBlock) { await wait(4000); continue; }

    const logs = await client.getLogs({
      address: process.env.EVM_BRIDGE_CONTRACT as `0x${string}`,
      events:  ABI,
      fromBlock: lastBlock + 1n,
      toBlock:   current,
    });

    for (const log of logs) {
      const args = log.args as {
        holder:                `0x${string}`;
        schemaHash:            `0x${string}`;
        tokenId:               bigint;
        destinationChainId:    number;
        stellarPubKeyXdrHash:  `0x${string}`;
      };
      // 1. fraud check
      const score = await fetch(`${process.env.AI_FRAUD_URL}/score`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ subject: args.holder, schemaHash: args.schemaHash }),
      }).then((r) => r.json()).catch(() => ({ score: 0 }));

      if (score.score > Number(process.env.AI_FRAUD_THRESHOLD ?? "0.85")) {
        console.warn(`AI fraud rejected lock for ${args.holder}`);
        continue;
      }

      // 2. submit wrap_badge to Soroban — left as a TODO bound to the SDK
      console.log(`[relayer] would wrap for ${args.holder} score=${score.score}`);
    }
    lastBlock = current;
  }
}
