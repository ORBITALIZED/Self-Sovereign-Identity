/**
 * Predicate that decides whether operator-visibility log lines — i.e.
 * deployment-time warnings intended for the operations team, NOT the
 * application logger — should fire.
 *
 * Suppressed when:
 *  • `process.env.VITEST` is set (vitest worker bootstrap sets
 *    `VITEST=true` on every worker) — keeps vitest stdout clean.
 *  • `process.env.NODE_ENV === "test"` — covers ad-hoc smoke scripts
 *    that set NODE_ENV=test without going through vitest
 *    (e.g. `NODE_ENV=test node dist/index.js`).
 *
 * Anything else (development, production, CI, staging) emits the log.
 *
 * Use this for `app.log.warn(...)` lines that describe the deploy
 * configuration ("env var X is unset; route Y will degrade") rather
 * than per-request errors. Per-request errors should always flow
 * through the standard errorHandler so they keep their `requestId`
 * correlation and `StructuredErrorBody` shape.
 */
export function isOperationalLogEnabled(): boolean {
  return !process.env.VITEST && process.env.NODE_ENV !== "test";
}
