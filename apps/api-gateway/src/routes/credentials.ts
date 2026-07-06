import type { FastifyInstance } from "fastify";
import { z } from "zod";

const IssueBody = z.object({
  issuer:    z.string().min(56),
  subject:   z.string().min(56),
  schemaHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  cid:       z.string().min(1),
  validUntil: z.number().int().positive(),
});

export async function credentialsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = IssueBody.parse(req.body);
    // TODO: forward to Soroban via SDK
    reply.code(202);
    return { accepted: true, body };
  });

  app.get<{ Params: { subject: string } }>("/:subject", async () => {
    // TODO: forward to Soroban via SDK
    return [];
  });
}
