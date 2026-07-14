/**
 * Retry-with-backoff helper. Re-runs `fn` up to `maxAttempts` times,
 * doubling the delay between attempts (capped at `maxDelayMs`). Returns
 * the first successful result or throws the final error.
 *
 * Used by the API gateway for transient upstream failures (Soroban
 * RPC, Horizon, AI fraud) and not for cryptographic or transaction
 * submission paths — those should fail-fast.
 */

export interface RetryOptions {
  /** Total attempts including the first one. Default `3`. */
  maxAttempts?: number;
  /** Initial delay in ms. Default `200`. */
  initialDelayMs?: number;
  /** Cap for the doubled delay. Default `5_000`. */
  maxDelayMs?: number;
  /** Optional predicate — retry only when this returns true. Otherwise throw immediately. */
  shouldRetry?: (err: unknown) => boolean;
  /** Optional callback fired on every retry. Useful for structured logging. */
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const initialDelayMs = opts.initialDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 5_000;
  let delay = initialDelayMs;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) break;
      if (opts.shouldRetry && !opts.shouldRetry(e)) throw e;
      opts.onRetry?.(e, attempt, delay);
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
  throw lastErr;
}
