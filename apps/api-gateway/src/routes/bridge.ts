/**
 * Bridge routes — expose recent wrapped-badge events from the Stellar
 * Horizon contract-events endpoint.
 *
 *   GET /wrapped?limit=30&cursor=…   → list recent WrappedBadge events
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isOperationalLogEnabled } from "../lib/envGate.js";

const QUERY = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  cursor: z.string().optional(),
});

/**
 * Fetch wrapped-badge events from Horizon's contract events API.
 * Returns a shape compatible with the frontend BridgeMonitor component.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- Horizon API responses are dynamic JSON; type-safety is impractical */
function isBadgeWrappedEvent(r: any): boolean {
  return r.topic?.[0] === "badge_wrapped";
}

function mapHorizonEvent(r: any): {
  id: string;
  subject: string;
  sourceChainId: number;
  sourceTxHash: string;
  assetCode: string;
  ts: number;
} {
  const val = r.value ?? {};
  return {
    id: r.paging_token ?? r.id ?? "",
    subject: val.subject_pubkey ?? "",
    sourceChainId: Number(val.source_chain_id ?? 0),
    sourceTxHash: val.source_tx_hash ?? "",
    assetCode: val.asset_code ?? "",
    ts: new Date(r.ledger_close_time ?? r.closed_at ?? Date.now()).getTime(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

async function fetchWrappedEvents(
  horizonUrl: string,
  contractId: string,
  limit: number,
  cursor?: string,
): Promise<{
  events: Array<{
    id: string;
    subject: string;
    sourceChainId: number;
    sourceTxHash: string;
    assetCode: string;
    ts: number;
  }>;
  nextCursor: string | null;
}> {
  const url = new URL(`${horizonUrl.replace(/\/+$/, "")}/contracts/${contractId}/events`);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Horizon request failed: ${res.status} ${res.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = (await res.json()) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const records: unknown[] = body?._embedded?.records ?? [];

  const events = records.filter(isBadgeWrappedEvent).map(mapHorizonEvent);

  const recordsArr = records as Array<{ paging_token?: string }>;
  const lastRecord = recordsArr.length > 0 ? recordsArr[recordsArr.length - 1] : null;

  return {
    events,
    nextCursor: lastRecord?.paging_token ?? null,
  };
}

export function bridgeRoutes(app: FastifyInstance) {
  const horizonUrl = process.env.STELLAR_HORIZON_URL ?? "";
  const contractId = process.env.STELLAR_WRAPPED_BADGE_CONTRACT ?? "";

  // Operator-visibility warnings only fire under normal runtime — not
  // during vitest runs or ad-hoc `NODE_ENV=test` smoke scripts — so test
  // output isn't polluted by these on every `build()` registration.
  if (isOperationalLogEnabled()) {
    if (!horizonUrl) {
      app.log.warn("STELLAR_HORIZON_URL not set — /bridge/wrapped will return empty results");
    }
    if (!contractId) {
      app.log.warn(
        "STELLAR_WRAPPED_BADGE_CONTRACT not set — /bridge/wrapped will return empty results",
      );
    }
  }

  app.get<{
    Querystring: { limit?: string; cursor?: string };
  }>("/wrapped", async (req, reply) => {
    const q = QUERY.parse(req.query);

    if (!horizonUrl || !contractId) {
      return { events: [], nextCursor: null };
    }

    try {
      const result = await fetchWrappedEvents(horizonUrl, contractId, q.limit, q.cursor);
      return result;
    } catch (e) {
      reply.code(502);
      return { error: (e as Error).message };
    }
  });

  // ── SSE endpoint: real-time bridge event stream ──────────────────────
  app.get("/events/stream", (req, reply) => {
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    if (!horizonUrl || !contractId) {
      reply.raw.write(`event: error\ndata: {"message":"Horizon not configured"}\n\n`);
      reply.raw.end();
      return;
    }

    let cursor: string | undefined;
    let active = true;

    req.raw.on("close", () => {
      active = false;
    });

    // Heartbeat every 15s to prevent proxy timeouts.
    const heartbeat = setInterval(() => {
      if (!active) {
        clearInterval(heartbeat);
        return;
      }
      reply.raw.write(": heartbeat\n\n");
    }, 15_000);

    // Async polling loop — runs in background, disconnected from the
    // handler's synchronous return path via `reply.hijack()`.
    const poll = async () => {
      // 1. Send initial batch (up to 30 events) for a quick first render.
      try {
        const initial = await fetchWrappedEvents(horizonUrl, contractId, 30, cursor);
        for (const ev of initial.events) {
          if (!active) return;
          reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
        cursor = initial.nextCursor ?? undefined;
      } catch {
        // Horizon may not be reachable yet — client will see an empty list.
      }

      // 2. Poll every 3 s for new events.
      while (active) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (!active) break;

        try {
          const result = await fetchWrappedEvents(horizonUrl, contractId, 10, cursor);
          for (const ev of result.events) {
            if (!active) break;
            reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
          }
          if (result.nextCursor) cursor = result.nextCursor;
        } catch {
          // Transient Horizon error — skip this poll cycle.
          // (The client's EventSource.onerror fires on connection loss,
          //  and the initial fetch handles configuration errors.)
        }
      }

      // 3. Cleanup.
      clearInterval(heartbeat);
      reply.raw.end();
    };

    void poll();
  });
}
