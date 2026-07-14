/**
 * Relayer state persistence — tracks processed events and cursor position
 * so the relayer is crash-safe and idempotent.
 *
 * Uses a simple JSON file for persistence (no Postgres dependency).
 * In production, swap this for a Postgres/Redis backend — the interface
 * remains the same.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const STATE_PATH = process.env.RELAYER_STATE_PATH ?? resolve(process.cwd(), ".relayer-state.json");

/** Safely parse a bigint field from a parsed JSON object with a default. */
export function parseBigIntField(
  obj: Record<string, unknown>,
  key: string,
  fallback: bigint,
): bigint {
  const raw = obj[key];
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "bigint") {
    try {
      return BigInt(raw);
    } catch {
      // fall through to default
    }
  }
  return fallback;
}

export interface RelayerState {
  /** Last EVM block number fully processed. */
  lastEvmBlock: bigint;
  /** Set of processed event IDs (txHash:logIndex). */
  processedEvents: string[];
  /** Event IDs that have failed > MAX_RETRIES times (dead letter). */
  deadLetters: string[];
}

const MAX_RETRIES = 3;
const MAX_PROCESSED = 10_000; // prune to avoid unbounded growth

export class RelayerStateManager {
  private state: RelayerState;
  private retries: Map<string, number> = new Map();
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = {
      lastEvmBlock: 0n,
      processedEvents: [],
      deadLetters: [],
    };
  }

  /** Load persisted state from disk (idempotent — safe to call multiple times). */
  async load(): Promise<void> {
    if (existsSync(STATE_PATH)) {
      try {
        const raw = await readFile(STATE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        this.state = {
          lastEvmBlock: parseBigIntField(parsed, "lastEvmBlock", 0n),
          processedEvents: Array.isArray(parsed.processedEvents) ? parsed.processedEvents : [],
          deadLetters: Array.isArray(parsed.deadLetters) ? parsed.deadLetters : [],
        };
      } catch {
        console.warn("[relayer] failed to load state file, starting fresh");
      }
    }
  }

  /** Check whether an event has already been processed. */
  isProcessed(eventId: string): boolean {
    return this.state.processedEvents.includes(eventId);
  }

  /** Check whether an event is in the dead-letter queue. */
  isDeadLetter(eventId: string): boolean {
    return this.state.deadLetters.includes(eventId);
  }

  /** Record a successfully processed event. */
  markProcessed(eventId: string): void {
    if (this.state.processedEvents.includes(eventId)) return;
    this.state.processedEvents.push(eventId);
    this.retries.delete(eventId);
    this.prune();
    this.scheduleSave();
  }

  /** Record a failed event attempt. Returns true if it should be retried. */
  recordFailure(eventId: string): boolean {
    const count = (this.retries.get(eventId) ?? 0) + 1;
    this.retries.set(eventId, count);
    if (count >= MAX_RETRIES) {
      this.state.deadLetters.push(eventId);
      this.scheduleSave();
      return false;
    }
    return true;
  }

  /** Update the last processed block number. */
  setLastBlock(block: bigint): void {
    if (block <= this.state.lastEvmBlock) return;
    this.state.lastEvmBlock = block;
    this.scheduleSave();
  }

  getLastBlock(): bigint {
    return this.state.lastEvmBlock;
  }

  getDeadLetters(): string[] {
    return [...this.state.deadLetters];
  }

  /** Prune processed events and dead-letter lists to prevent unbounded growth. */
  private prune(): void {
    if (this.state.processedEvents.length > MAX_PROCESSED) {
      this.state.processedEvents = this.state.processedEvents.slice(-MAX_PROCESSED / 2);
    }
    if (this.state.deadLetters.length > MAX_PROCESSED) {
      this.state.deadLetters = this.state.deadLetters.slice(-MAX_PROCESSED / 2);
    }
  }

  /** Debounced save to disk. */
  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 2000);
  }

  /** Force immediate save to disk. */
  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const json = JSON.stringify(
        {
          lastEvmBlock: this.state.lastEvmBlock.toString(),
          processedEvents: this.state.processedEvents,
          deadLetters: this.state.deadLetters,
        },
        null,
        2,
      );
      await writeFile(STATE_PATH, json, "utf-8");
    } catch (err) {
      this.dirty = true;
      console.error("[relayer] failed to persist state:", err);
    }
  }
}
