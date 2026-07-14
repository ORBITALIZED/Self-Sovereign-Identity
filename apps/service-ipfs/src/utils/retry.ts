/**
 * Tiny retry-with-backoff helper for the IPFS service. Re-runs `fn` up
 * to `maxAttempts` times, doubling the delay between attempts (capped
 * at `maxDelayMs`). Promise-rejecting failures are retried; AbortError
 * / non-Error throws bubble through immediately.
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const initialDelayMs = opts.initialDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 2_000;
  let delay = initialDelayMs;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) break;
      opts.onRetry?.(e, attempt, delay);
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
  throw lastErr;
}
