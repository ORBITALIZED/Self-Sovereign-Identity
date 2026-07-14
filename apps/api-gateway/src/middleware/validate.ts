/**
 * Generic request validation middleware factory.
 *
 * Wraps a Zod schema into a Fastify preHandler that validates
 * `req.body` (or a configurable property) and returns a 400 with
 * structured error details on failure.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, ZodError } from "zod";

export interface ValidateOptions {
  /** Which request property to validate (default: "body"). */
  source?: "body" | "query" | "params";
}

/** Create a preHandler that validates the request against a Zod schema. */
export function validate(
  schema: ZodSchema,
  opts: ValidateOptions = {},
) {
  const source = opts.source ?? "body";

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = schema.safeParse(req[source as keyof FastifyRequest]);
    if (!parsed.success) {
      const err = parsed.error as ZodError;
      reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
  };
}
