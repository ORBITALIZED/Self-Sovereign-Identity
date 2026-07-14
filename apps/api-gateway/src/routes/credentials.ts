import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { strKeyToPubKey } from "@ssi/sdk";
import { getStellar } from "../lib/stellarClient.js";

const IssueBody = z.object({
  issuer: z.string().min(56),
  subject: z.string().min(56),
  schemaHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  cid: z.string().min(1),
  validUntil: z.number().int().positive(),
  signedInvokeXdr: z.string().min(1).optional(),
});

export async function credentialsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = IssueBody.parse(req.body);
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return { error: "STELLAR_NOT_CONFIGURED" };
    }
    try {
      if (body.signedInvokeXdr) {
        const txHash = await stellar.submitTransaction(body.signedInvokeXdr);
        return { accepted: true, txHash };
      }
      // Fallback when no pre-signed XDR: echo the issuance payload for
      // the wallet/frontend to sign and resubmit.
      return { accepted: true, body };
    } catch (e) {
      reply.code(500);
      return { error: (e as Error).message };
    }
  });

  app.get<{ Params: { subject: string } }>("/:subject", async (req, reply) => {
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return { error: "STELLAR_NOT_CONFIGURED" };
    }
    try {
      const subjectKey = strKeyToPubKey(req.params.subject);
      const credentials = await stellar.credentials.list(subjectKey);
      return credentials;
    } catch (e) {
      reply.code(502);
      return { error: (e as Error).message };
    }
  });

  app.get<{ Params: { subject: string } }>("/:subject/count", async (req, reply) => {
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return { error: "STELLAR_NOT_CONFIGURED" };
    }
    try {
      const subjectKey = strKeyToPubKey(req.params.subject);
      const credentials = await stellar.credentials.list(subjectKey);
      return { count: credentials.length };
    } catch (e) {
      reply.code(502);
      return { error: (e as Error).message };
    }
  });
}
