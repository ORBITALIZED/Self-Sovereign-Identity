import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SSIStellar, strKeyToPubKey } from "@ssi/sdk";

const IssueBody = z.object({
  issuer: z.string().min(56),
  subject: z.string().min(56),
  schemaHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  cid: z.string().min(1),
  validUntil: z.number().int().positive(),
});

function buildStellar(): SSIStellar | null {
  const horizonUrl = process.env.STELLAR_HORIZON_URL;
  if (!horizonUrl) return null;
  return new SSIStellar({
    horizonUrl,
    rpcUrl: process.env.STELLAR_SOROBAN_RPC_URL ?? "",
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? "",
    identityContractId: process.env.STELLAR_IDENTITY_CONTRACT ?? "",
    wrappedBadgeContractId: process.env.STELLAR_WRAPPED_BADGE_CONTRACT ?? "",
    sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL,
  });
}

let _stellar: SSIStellar | null | undefined;
function getStellar(): SSIStellar | null {
  if (_stellar === undefined) _stellar = buildStellar();
  return _stellar;
}

export async function credentialsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = IssueBody.parse(req.body);
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return { error: "STELLAR_NOT_CONFIGURED" };
    }
    try {
      const { subject } = body;
      const subjectKey = strKeyToPubKey(subject);
      const credentials = await stellar.credentials.list(subjectKey);
      return { accepted: true, count: credentials.length };
    } catch (e) {
      reply.code(502);
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
