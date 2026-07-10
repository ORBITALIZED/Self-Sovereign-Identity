/**
 * EVM-side listener: subscribes to `BadgeLocked` events emitted by the
 * `WrappedBadge` contract. For each event:
 *   1. Query the AI fraud service for a score on `(issuer, holder)`.
 *   2. Fetch the credential CID from the SBT contract.
 *   3. Submit a `wrap_badge` invocation to Soroban (via SDK).
 */

import { createPublicClient, http, parseAbi, getContract } from "viem";
import { setTimeout as wait } from "node:timers/promises";
import { SSIStellar, hexToBytes } from "@ssi/sdk";

const ABI = parseAbi([
  "event BadgeLocked(address indexed holder, bytes32 indexed schemaHash, uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
]);

// WrappedBadge SBT ABI — only the functions we need to query the locked badge.
const SBT_ABI = parseAbi([
  "function credentials(uint256 tokenId) view returns (bytes32 schemaHash, string cid, uint64 issuedAt, uint64 validUntil, bool revoked)",
]);

/** Initialise the Soroban SDK client used by the relayer to submit wrap calls. */
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

export async function startEvmListener() {
  const relayerSecret = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerSecret) {
    throw new Error("RELAYER_PRIVATE_KEY is required");
  }
  const evmRpcUrl = process.env.EVM_RPC_URL;
  if (!evmRpcUrl) {
    throw new Error("EVM_RPC_URL is required");
  }
  const bridgeContractAddr = process.env.EVM_BRIDGE_CONTRACT as `0x${string}` | undefined;
  if (!bridgeContractAddr) {
    throw new Error("EVM_BRIDGE_CONTRACT is required");
  }
  const sbtContractAddr = process.env.EVM_SBT_CONTRACT as `0x${string}` | undefined;
  if (!sbtContractAddr) {
    throw new Error("EVM_SBT_CONTRACT is required");
  }

  const client = createPublicClient({
    transport: http(evmRpcUrl),
  });
  const sbt = getContract({
    address: sbtContractAddr,
    abi: SBT_ABI,
    client,
  });
  const stellar = createStellarClient();

  // Subscribe via websocket — falls back to polling every 12 blocks.
  // Polling scaffold for now (WS subscription needs an authenticated WS endpoint).
  let lastBlock = await client.getBlockNumber();

  while (true) {
    const current = await client.getBlockNumber();
    if (current <= lastBlock) {
      await wait(4000);
      continue;
    }

    const logs = await client.getLogs({
      address: bridgeContractAddr,
      events: ABI,
      fromBlock: lastBlock + 1n,
      toBlock: current,
    });

    for (const log of logs) {
      const args = log.args as {
        holder: `0x${string}`;
        schemaHash: `0x${string}`;
        tokenId: bigint;
        destinationChainId: number;
        stellarPubKeyXdrHash: `0x${string}`;
      };

      // 1. Fraud check
      const scoreRes = await fetch(`${process.env.AI_FRAUD_URL}/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: args.holder, schemaHash: args.schemaHash }),
      })
        .then((r) => r.json() as Promise<{ score: number }>)
        .catch<{ score: number }>(() => ({ score: 0 }));

      if (scoreRes.score > Number(process.env.AI_FRAUD_THRESHOLD ?? "0.85")) {
        console.warn(`AI fraud rejected lock for ${args.holder}`);
        continue;
      }

      // 2. Fetch credential CID from the SBT contract
      let cid: string;
      try {
        const cred = await sbt.read.credentials([args.tokenId]);
        cid = cred[1]; // cid is the second field in the Credential tuple
      } catch (err) {
        console.error(`Failed to fetch credentials for token ${args.tokenId}:`, err);
        continue;
      }

      // 3. Submit wrap_badge to Soroban
      const txHashHex = log.transactionHash;
      if (!txHashHex) {
        console.warn("[relayer] missing transactionHash for BadgeLocked log, skipping");
        continue;
      }

      try {
        const txHash = await stellar.wrappedBadge.wrap({
          subjectPubkey: hexToBytes(args.stellarPubKeyXdrHash),
          sourceChainId: Number(args.destinationChainId),
          sourceTxHash: hexToBytes(txHashHex),
          cid,
          schemaHash: hexToBytes(args.schemaHash),
          relayerSecret,
        });
        console.log(`[relayer] wrapped badge for ${args.holder} tx=${txHash}`);
      } catch (err) {
        console.error(`[relayer] wrap failed for ${args.holder}:`, err);
      }
    }
    lastBlock = current;
  }
}
