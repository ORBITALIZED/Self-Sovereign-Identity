/**
 * Bridge routes — expose recent wrapped-badge events from the Stellar
 * Horizon contract-events endpoint.
 *
 *   GET /wrapped?limit=30&cursor=…   → list recent WrappedBadge events
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isOperationalLogEnabled } from "../middleware/envGate.js";

const QUERY = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  cursor: z.string().optional(),
});

/**
 * Fetch wrapped-badge events from Horizon's contract events API.
 * Returns a shape compatible with the frontend BridgeMonitor component.
 */
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
  const body: any = await res.json();
  const records: unknown[] = body?._embedded?.records ?? [];

  const events = records
    // Filter to only badge_wrapped topics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.topic?.[0] === "badge_wrapped")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => {
      // Horizon contract events have a `value` field with the decoded event data
      const val = r.value ?? {};
      return {
        id: r.paging_token ?? r.id ?? "",
        subject: val.subject_pubkey ?? "",
        sourceChainId: Number(val.source_chain_id ?? 0),
        sourceTxHash: val.source_tx_hash ?? "",
        assetCode: val.asset_code ?? "",
        // Horizon contract events expose ledger_close_time in the enclosing
        // transaction's `closed_at` or the event record's `ledger_close_time`.
        // Fall back to the current time if neither is available (scaffold).
        ts: new Date(r.ledger_close_time ?? r.closed_at ?? Date.now()).getTime(),
      };
    });

  const recordsArr = records as Array<{ paging_token?: string }>;
  const lastRecord = recordsArr.length > 0 ? recordsArr[recordsArr.length - 1] : null;

  return {
    events,
    nextCursor: lastRecord?.paging_token ?? null,
  };
}

export async function bridgeRoutes(app: FastifyInstance) {
  const horizonUrl = process.env.STELLAR_HORIZON_URL ?? "";
  const contractId = process.env.STELLAR_WRAPPED_BADGE_CONTRACT ?? "";

  // Operator-visibility warnings only fire under normal runtime — not
  // during vitest runs or ad-hoc `NODE_ENV=test` smoke scripts — so test
  // output isn't polluted by these on every `build()` registration.
  if (isOperationalLogEnabled()) {
    if (!horizonUrl) {
      app.log.warn(
        "STELLAR_HORIZON_URL not set — /bridge/wrapped will return empty results",
      );
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
}
