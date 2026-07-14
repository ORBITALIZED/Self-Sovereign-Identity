/**
 * EVM-side listener: subscribes to `BadgeLocked` events emitted by the
 * `WrappedBadge` contract. For each event:
 *   1. Deduplicate: skip already-processed or dead-letter events.
 *   2. Query the AI fraud service for a score on `(issuer, holder)`.
 *   3. Fetch the credential CID from the SBT contract.
 *   4. Submit a `wrap_badge` invocation to Soroban (via SDK).
 *   5. Persist state: mark event as processed, update cursor.
 *
 * Crash-safe: state is persisted to a JSON file via RelayerStateManager.
 * On restart, the relayer resumes from the last processed block.
 */

import { createPublicClient, http, parseAbi, getContract } from "viem";
import { setTimeout as wait } from "node:timers/promises";
import { SSIStellar, hexToBytes } from "@ssi/sdk";
import { RelayerStateManager } from "../state.js";

const ABI = parseAbi([
  "event BadgeLocked(address indexed holder, bytes32 indexed schemaHash, uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
]);

const SBT_ABI = parseAbi([
  "function credentials(uint256 tokenId) view returns (bytes32 schemaHash, string cid, uint64 issuedAt, uint64 validUntil, bool revoked)",
]);

function createStellarClient(): SSIStellar {
  return new SSIStellar({
    horizonUrl: process.env.STELLAR_HORIZON_URL!,
    rpcUrl: process.env.STELLAR_SOROBAN_RPC_URL!,
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
    identityContractId: process.env.STELLAR_IDENTITY_CONTRACT ?? "",
    wrappedBadgeContractId: process.env.STELLAR_WRAPPED_BADGE_CONTRACT ?? "",
    sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL,
  });
}

/** Build a stable event ID from txHash + logIndex. */
function eventId(txHash: string, logIndex: number): string {
  return `${txHash}:${logIndex}`;
}

export async function startEvmListener(stateManager?: RelayerStateManager) {
  const relayerSecret = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerSecret) throw new Error("RELAYER_PRIVATE_KEY is required");

  const evmRpcUrl = process.env.EVM_RPC_URL;
  if (!evmRpcUrl) throw new Error("EVM_RPC_URL is required");

  const bridgeContractAddr = process.env.EVM_BRIDGE_CONTRACT as `0x${string}` | undefined;
  if (!bridgeContractAddr) throw new Error("EVM_BRIDGE_CONTRACT is required");

  const sbtContractAddr = process.env.EVM_SBT_CONTRACT as `0x${string}` | undefined;
  if (!sbtContractAddr) throw new Error("EVM_SBT_CONTRACT is required");

  const client = createPublicClient({ transport: http(evmRpcUrl) });
  const sbt = getContract({ address: sbtContractAddr, abi: SBT_ABI, client });
  const stellar = createStellarClient();

  // Load persisted state for crash recovery, or start fresh.
  let state: RelayerStateManager;
  if (stateManager) {
    state = stateManager;
  } else {
    state = new RelayerStateManager();
    await state.load();
  }

  let lastBlock = state.getLastBlock();
  if (lastBlock === 0n) {
    lastBlock = await client.getBlockNumber();
    state.setLastBlock(lastBlock);
  }

  console.log(`[relayer] resuming from block ${lastBlock}`);

  while (true) {
    const current = await client.getBlockNumber();
    if (current <= lastBlock) {
      await wait(4000);
      continue;
    }

    const fromBlock = lastBlock + 1n;
    const toBlock = current;

    let logs: Awaited<ReturnType<typeof client.getLogs>>;
    try {
      logs = await client.getLogs({
        address: bridgeContractAddr,
        events: ABI,
        fromBlock,
        toBlock,
      });
    } catch (err) {
      console.error(`[relayer] getLogs failed for blocks ${fromBlock}-${toBlock}:`, err);
      await wait(8000);
      continue;
    }

    for (const log of logs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;

      const logIdx = typeof log.logIndex === "number" ? log.logIndex : Number(log.logIndex ?? 0);
      const evId = eventId(txHash, logIdx);

      // === Idempotency check ===
      if (state.isProcessed(evId)) continue;

      // === Dead-letter check ===
      if (state.isDeadLetter(evId)) {
        console.warn(`[relayer] skipping dead-letter event ${evId}`);
        state.markProcessed(evId); // mark processed so we don't keep retrying
        continue;
      }

      // viem returns parsed event args — access via type assertion for TS compat.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawArgs = (log as any).args as [
        `0x${string}`, // holder (indexed)
        `0x${string}`, // schemaHash (indexed)
        bigint, // tokenId
        number, // destinationChainId
        `0x${string}`, // stellarPubKeyXdrHash
      ];
      const [holder, schemaHash, tokenId, destinationChainId, stellarPubKeyXdrHash] = rawArgs;

      if (!holder || !schemaHash || !stellarPubKeyXdrHash) continue;

      const args = {
        holder,
        schemaHash,
        tokenId: BigInt(tokenId),
        destinationChainId: Number(destinationChainId),
        stellarPubKeyXdrHash,
      };

      // 1. Fraud check
      let fraudScore = 0;
      try {
        const scoreRes = await fetch(`${process.env.AI_FRAUD_URL}/score`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject: args.holder, schemaHash: args.schemaHash }),
        }).then((r) => r.json() as Promise<{ score: number }>);
        fraudScore = scoreRes.score;
      } catch {
        // AI fraud service unavailable — soft-fail open
      }

      const threshold = Number(process.env.AI_FRAUD_THRESHOLD ?? "0.85");
      if (fraudScore > threshold) {
        console.warn(`[relayer] fraud reject ${args.holder} score=${fraudScore} > ${threshold}`);
        state.markProcessed(evId);
        continue;
      }

      // 2. Fetch credential CID
      let cid: string;
      try {
        const cred = await sbt.read.credentials([args.tokenId]);
        cid = cred[1];
      } catch (err) {
        console.error(`[relayer] credentials fetch failed for token ${args.tokenId}:`, err);
        if (!state.recordFailure(evId)) {
          console.error(`[relayer] dead-lettering ${evId} after ${3} failures`);
        }
        continue;
      }

      // 3. Submit wrap_badge to Soroban (contract provides native idempotency)
      try {
        const sorobanTxHash = await stellar.wrappedBadge.wrap({
          subjectPubkey: hexToBytes(args.stellarPubKeyXdrHash),
          sourceChainId: Number(args.destinationChainId),
          sourceTxHash: hexToBytes(txHash),
          cid,
          schemaHash: hexToBytes(args.schemaHash),
          relayerSecret,
        });
        console.log(`[relayer] wrapped badge for ${args.holder} sorobanTx=${sorobanTxHash}`);
        state.markProcessed(evId);
      } catch (err) {
        console.error(`[relayer] wrap failed for ${args.holder}:`, err);
        if (!state.recordFailure(evId)) {
          console.error(`[relayer] dead-lettering ${evId} after ${3} failures`);
        }
      }
    }

    // Persist cursor after processing all logs in this block range.
    lastBlock = current;
    state.setLastBlock(current);
  }
}
