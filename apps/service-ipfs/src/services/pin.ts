/**
 * /pin and /cid endpoints backed by Helia.
 */

import type { FastifyInstance } from "fastify";
import { createHelia } from "helia";
import { json }        from "@helia/json";
import { crypto }      from "./encrypt.js";

const helia     = await createHelia();
const heliaJson = json(helia);

interface PinBody { payload: string /* base64 */ }

export async function pinRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: PinBody }>("/pin", async (req, reply) => {
    if (!req.body?.payload) { reply.code(400); return { error: "missing payload" }; }
    const raw  = Buffer.from(req.body.payload, "base64");
    const enc  = await crypto.encrypt(raw);
    const blob = new Blob([enc.iv, enc.ciphertext]);
    const cid  = await heliaJson.add({ v: new Uint8Array(blob) as any });
    return { cid: String(cid) };
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
