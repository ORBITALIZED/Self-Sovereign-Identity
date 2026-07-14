import type { FastifyInstance } from "fastify";

const HORIZON_TIMEOUT_MS = 1_500;

/**
 * HEAD-style ping against the configured Stellar Horizon URL. Returns
 * `true` iff the server returns 2xx within `HORIZON_TIMEOUT_MS`.
 *
 * Reasoning: /ready should fail before k8s routes traffic; capping the
 * timeout at 1.5s keeps the probe loop tight even when the upstream is
 * slow-but-reachable.
 */
async function pingHorizon(horizonUrl: string): Promise<boolean> {
  if (!horizonUrl) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HORIZON_TIMEOUT_MS);
  try {
    const res = await fetch(`${horizonUrl.replace(/\/+$/, "")}/`, {
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? "0.0.0",
  }));

  app.get("/ready", async (_req, reply) => {
    const horizonUrl = process.env.STELLAR_HORIZON_URL ?? "";
    const downstream = {
      stellarHorizon: await pingHorizon(horizonUrl),
    };
    const allUp = Object.values(downstream).every(Boolean);
    reply.code(allUp ? 200 : 503);
    return {
      status: allUp ? "ready" : "degraded",
      downstream,
    };
  });
}
