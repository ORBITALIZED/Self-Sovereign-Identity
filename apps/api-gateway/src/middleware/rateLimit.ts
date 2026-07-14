/**
 * Simple in-memory sliding-window rate limiter for the API gateway.
 *
 * Limits requests per IP address within a configurable window.
 * Not suitable for multi-process deployments — swap for Redis-backed
 * rate limiting in production (e.g., @fastify/rate-limit with Redis store).
 */

import type { FastifyRequest, FastifyReply } from "fastify";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? "100");
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"); // 1 minute

/** Clean up expired entries every 5 minutes to prevent memory leaks. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 300_000).unref();

export async function rateLimit(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  let entry = windows.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(ip, entry);
  }

  entry.count++;

  reply.header("X-RateLimit-Limit", MAX_REQUESTS);
  reply.header("X-RateLimit-Remaining", Math.max(0, MAX_REQUESTS - entry.count));
  reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

  if (entry.count > MAX_REQUESTS) {
    reply.code(429).send({
      error: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
      retryable: true,
    });
  }
}
