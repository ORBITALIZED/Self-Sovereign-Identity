import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SSIStellar } from "@ssi/sdk";

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

/**
 * Construct the Stellar client lazily, on first use, so the gateway can
 * boot (and serve other routes like /health, /ready, /bridge/wrapped)
 * even when `STELLAR_HORIZON_URL` is not configured.
 *
 * If env vars are missing at request time, we return `null` and the route
 * handler responds with a 503 + `stellar_not_configured` instead of
 * letting the SDK throw a `ChainConnectionError`.
 */
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

// Cache the SDK instance per-process so we only pay the (deferred)
// `await import("@stellar/stellar-sdk")` cost once across all requests.
let _stellar: SSIStellar | null | undefined;
function getStellar(): SSIStellar | null {
  if (_stellar === undefined) _stellar = buildStellar();
  return _stellar;
}

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
