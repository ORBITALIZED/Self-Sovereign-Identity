import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export async function errorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  req.log.error(err);

  const status = err.statusCode ?? 500;
  reply.code(status);

  // Hide stack traces in prod
  const show = process.env.NODE_ENV !== "production";
  return {
    error: err.name ?? "Error",
    message: err.message,
    ...(show ? { stack: err.stack } : {}),
  };
}
