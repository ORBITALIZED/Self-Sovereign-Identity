import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

/** Stable string codes that downstream consumers (mobile/web) can switch on. */
export type ErrorCode =
  | "INTERNAL"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UPSTREAM"
  | "RATE_LIMITED";

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION",
  401: "UNAUTHENTICATED",
  403: "UNAUTHORIZED",
  404: "NOT_FOUND",
  422: "VALIDATION",
  429: "RATE_LIMITED",
  502: "UPSTREAM",
  503: "UPSTREAM",
  504: "UPSTREAM",
};

export interface StructuredErrorBody {
  error: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
  retryable?: boolean;
}

export async function errorHandler(err: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  // `requestId` is augmented onto FastifyRequest by `middleware/requestId.ts`
  // as an OPTIONAL property — errors raised BEFORE the `onRequest` hook
  // (body-parser failures, router mismatches) reach this handler without a
  // populated id, so we always coerce to a defined string before logging.
  const requestId = req.requestId ?? "(no-request-id)";
  req.log.error({ err, requestId }, "request failed");

  const status = err.statusCode ?? 500;
  const code: ErrorCode =
    STATUS_TO_CODE[status] ??
    (status >= 500 ? "INTERNAL" : STATUS_TO_CODE[400] ?? "VALIDATION");

  reply.code(status);

  const body: StructuredErrorBody = {
    error: code,
    message: err.message ?? "request failed",
    requestId: req.requestId,
    retryable: status >= 500,
  };

  // Hide stack traces in prod. Details only leak when explicitly set.
  if (process.env.NODE_ENV !== "production" && err.stack) {
    body.details = { stack: err.stack };
  }

  return body;
}
