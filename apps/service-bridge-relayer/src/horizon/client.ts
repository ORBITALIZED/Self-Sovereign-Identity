/**
 * Horizon SSE client — streams contract events to the API gateway.
 *
 * Parses Horizon's Server-Sent Events endpoint for contract events
 * and emits typed events via EventEmitter for downstream consumers.
 */

import { EventEmitter } from "eventemitter3";
import { setTimeout as wait } from "node:timers/promises";

const HORIZON = process.env.STELLAR_HORIZON_URL ?? "";

/** Parsed SSE event from Horizon's contract-events stream. */
export interface ContractEvent {
  pagingToken: string;
  contractId: string;
  topic: string[];
  value: Record<string, unknown>;
  ledgerCloseTime: string;
}

export class HorizonStream extends EventEmitter {
  private cursor: string | undefined;
  private running = false;

  /**
   * Start streaming contract events from Horizon.
   *
   * Opens an long-lived HTTP connection with `Accept: text/event-stream`
   * and parses the SSE data lines as JSON.  On connection errors or EOF
   * the loop waits 1s and reconnects from the last consumed cursor.
   */
  async startListening(contractId: string): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.running) {
      try {
        const url = new URL(`${HORIZON.replace(/\/+$/, "")}/contracts/${contractId}/events`);
        url.searchParams.set("limit", "200");
        if (this.cursor) url.searchParams.set("cursor", this.cursor);

        const res = await fetch(url.toString(), {
          headers: { Accept: "text/event-stream" },
        });

        if (!res.ok || !res.body) {
          await wait(1000);
          continue;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (!raw) continue;
              try {
                const ev: ContractEvent = JSON.parse(raw);
                this.cursor = ev.pagingToken;
                this.emit("event", ev);
                this.emit(ev.topic[0] ?? "unknown", ev);
              } catch {
                // Malformed JSON — skip and continue
              }
            }
          }
        }
      } catch {
        await wait(5000);
      }
    }
  }

  stop() {
    this.running = false;
  }
}

const stream = new HorizonStream();
export async function startHorizonStream() {
  const contractId = process.env.STELLAR_WRAPPED_BADGE_CONTRACT;
  if (!contractId) {
    console.warn("[horizon-sse] STELLAR_WRAPPED_BADGE_CONTRACT not set, SSE disabled");
    return;
  }
  void stream.startListening(contractId);
}
