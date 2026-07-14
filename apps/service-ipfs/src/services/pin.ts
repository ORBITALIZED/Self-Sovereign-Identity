/**
 * /pin and /cid endpoints backed by Helia.
 *  - /pin uses AES-GCM encryption from `./encrypt.ts` before storage.
 *  - /pin validates the base64 payload upfront and retries on transient
 *    Helia errors via `utils/retry.ts`.
 */

import type { FastifyInstance } from "fastify";
import { createHelia } from "helia";
import { json } from "@helia/json";
// Rename the import to avoid shadowing the global `crypto` (Web Crypto API).
import { crypto as ssiCrypto } from "./encrypt.js";
import { withRetry } from "../utils/retry.js";

const helia = await createHelia();
const heliaJson = json(helia);

interface PinBody {
  payload: string; /* base64 */
}

const MAX_PAYLOAD_BYTES = 1_000_000; // 1 MB upper bound — keep backends honest

function validateBase64(input: string): Buffer {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("payload must be a non-empty base64 string");
  }
  // Strict base64 alphabet (RFC 4648) — Node's Buffer will accept either
  // padded or unpadded input but reject characters outside the alphabet.
  const buf = Buffer.from(input, "base64");
  if (buf.length === 0) {
    throw new Error("payload decoded to 0 bytes");
  }
  if (buf.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }
  // Reject silently-truncated input: re-encode and compare.
  if (buf.toString("base64").replace(/=+$/, "") !== input.replace(/=+$/, "")) {
    throw new Error("payload is not valid base64");
  }
  return buf;
}

export async function pinRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  app.get("/pin/status", async () => {
    const peers = await (helia.libp2p as any).getPeers?.() ?? [];
    return {
      status: "ok",
      peerCount: Array.isArray(peers) ? peers.length : 0,
      nodeId: helia.libp2p.peerId.toString(),
    };
  });

  app.post<{ Body: PinBody }>("/pin", async (req, reply) => {
    let raw: Buffer;
    try {
      raw = validateBase64(req.body?.payload ?? "");
    } catch (e) {
      reply.code(400);
      return { error: (e as Error).message };
    }

    let cid: string;
    try {
      cid = await withRetry(
        async () => {
          const enc = await ssiCrypto.encrypt(raw);
          // Concatenate iv + ciphertext into a single Uint8Array
          const combined = new Uint8Array(enc.iv.length + enc.ciphertext.length);
          combined.set(enc.iv, 0);
          combined.set(enc.ciphertext, enc.iv.length);
          const c = await heliaJson.add({ v: combined });
          return String(c);
        },
        {
          maxAttempts: 3,
          initialDelayMs: 200,
          maxDelayMs: 2_000,
          onRetry: (err, attempt) => req.log.warn({ err, attempt }, "/pin transient retry"),
        },
      );
    } catch (err) {
      req.log.error({ err }, "/pin failed after retries");
      reply.code(502);
      return { error: "pin failed" };
    }

    return { cid };
  });

  app.get<{ Params: { cid: string } }>("/cid/:cid", async (req, reply) => {
    try {
      const data: any = await heliaJson.get(req.params.cid as any);
      return { ok: true, bytes: data.bytes ?? data };
    } catch (e) {
      reply.code(404);
      return { error: (e as Error).message };
    }
  });
}
