import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SSIZkp } from "@ssi/sdk/zkp";
import fs from "node:fs";

const zkp = new SSIZkp();

const ProveBody = z.object({
  circuit: z.enum(["credential", "age_verification"]),
  input: z.record(z.unknown()),
});

const VerifyBody = z.object({
  vKey: z.record(z.unknown()),
  publicSignals: z.array(z.string()),
  proof: z.object({
    pi_a: z.array(z.string()),
    pi_b: z.array(z.array(z.string())),
    pi_c: z.array(z.string()),
    protocol: z.string(),
    curve: z.string(),
  }),
});

export async function zkpRoutes(app: FastifyInstance) {
  app.post("/prove", async (req) => {
    const body = ProveBody.parse(req.body);
    const root = process.env.ZK_CIRCUITS_ROOT ?? "./packages/zk-circuits";
    const wasm = `${root}/build/${body.circuit}_js/${body.circuit}.wasm`;
    const zkey = `${root}/keys/${body.circuit}_final.zkey`;
    return zkp.prove({ wasm, zkey, input: body.input });
  });

  app.post("/verify", async (req) => {
    const body = VerifyBody.parse(req.body);
    return { valid: await zkp.verify(body.vKey, body.publicSignals, body.proof) };
  });

  app.get("/vkey/:circuit", async (req, reply) => {
    const root = process.env.ZK_CIRCUITS_ROOT ?? "./packages/zk-circuits";
    const path = `${root}/keys/${(req.params as any).circuit}_vkey.json`;
    if (!fs.existsSync(path)) {
      reply.code(404);
      return { error: "not_found" };
    }
    return JSON.parse(fs.readFileSync(path, "utf8"));
  });
}
