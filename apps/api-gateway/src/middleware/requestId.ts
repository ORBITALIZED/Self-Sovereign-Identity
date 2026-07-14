import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

/**
 * Request-id middleware. Ensures every request has a `request.id` and a
 * matching `X-Request-Id` response header so the client can correlate logs
 * across services. If the client provides an `X-Request-Id` we keep it
 * (validated so it can't be used for log-injection attacks); otherwise we
 * mint a fresh UUIDv4.
 *
 * Hard limits:
 *   * Max incoming length: 128 chars
 *   * Allowed chars: `[A-Za-z0-9._:-]`
 */
const MAX_LEN = 128;
const ALLOWED = /^[A-Za-z0-9._-]+$/;

declare module "fastify" {
  interface FastifyRequest {
    /** Stable id for this request. Set by `requestIdPlugin`. */
    requestId: string;
  }
}

export async function registerRequestId(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", (req: FastifyRequest, _reply: FastifyReply, done) => {
    const incoming = req.headers["x-request-id"];
    const candidate =
      typeof incoming === "string" ? incoming : Array.isArray(incoming) ? incoming[0] : undefined;

    let id: string;
    if (candidate && candidate.length > 0 && candidate.length <= MAX_LEN && ALLOWED.test(candidate)) {
      id = candidate;
    } else {
      id = randomUUID();
    }
    req.requestId = id;
    req.headers["x-request-id"] = id;
    done();
  });

  app.addHook("onSend", (req, reply, payload, done) => {
    // Always echo the id on the response header for client correlation.
    reply.header("x-request-id", req.requestId);
    done(null, payload);
  });
}
