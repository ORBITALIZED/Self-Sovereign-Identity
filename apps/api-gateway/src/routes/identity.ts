import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isOperationalLogEnabled } from "../lib/envGate.js";
import { getStellar } from "../lib/stellarClient.js";

/** Stable error code returned by both identity routes when the Stellar
 *  client is not configured. Matches the UPPER_SNAKE convention used in
 *  `errorHandler.ts` `STATUS_TO_CODE`. */
const STELLAR_NOT_CONFIGURED = "STELLAR_NOT_CONFIGURED" as const;

const STELLAR_NOT_CONFIGURED_BODY = {
  error: STELLAR_NOT_CONFIGURED,
  message:
    "Set STELLAR_HORIZON_URL, STELLAR_SOROBAN_RPC_URL and STELLAR_NETWORK_PASSPHRASE to enable identity routes.",
  retryable: true,
} as const;

// NOTE: the API never accepts a secret key — authentication happens with JWT
// and Soroban `invokeContract` is signed client-side via Freighter. This
// body schema mirrors what the wallet sends after the user signs.
const CreateBody = z.object({
  pubkey: z.string().min(56),
  biometricCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  metadataCid: z.string().min(1),
  recoveryOwners: z.array(z.string().min(56)).min(1),
  /** Base64 of the pre-signed Soroban invokeContract XDR — produced by the
   *  wallet, not by the API. The gateway submits it to the network as-is. */
  signedInvokeXdr: z.string().min(1),
});

export async function identityRoutes(app: FastifyInstance) {
  // Eager degraded-mode warn: runs once at route-registration (i.e. boot).
  // Operators see this regardless of /identity traffic, and the line flows
  // through Fastify's structured Pino logger so it joins the JSON log stream
  // used elsewhere in the system. The deploy-time visibility gate is
  // centralised in `lib/envGate.ts`.
  if (process.env.STELLAR_HORIZON_URL === undefined && isOperationalLogEnabled()) {
    app.log.warn(
      "STELLAR_HORIZON_URL not configured — /identity routes will return 503 STELLAR_NOT_CONFIGURED; see apps/api-gateway/.env.example",
    );
  }

  // The route is JWT-protected; downstream services verify the signature.
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return STELLAR_NOT_CONFIGURED_BODY;
    }
    try {
      const txHash = await stellar.submitTransaction(body.signedInvokeXdr);
      return { accepted: true, txHash };
    } catch (e) {
      reply.code(500);
      return { error: (e as Error).message };
    }
  });

  app.get<{ Params: { pubkey: string } }>("/:pubkey", async (req, reply) => {
    const stellar = getStellar();
    if (!stellar) {
      reply.code(503);
      return STELLAR_NOT_CONFIGURED_BODY;
    }
    const id = await stellar.identity.get(new Uint8Array(32));
    if (!id) {
      reply.code(404);
      return { error: "not_found" };
    }
    return id;
  });
}
