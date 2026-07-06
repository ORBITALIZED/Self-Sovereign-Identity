/**
 * Horizon SSE client — streams contract events to the API gateway.
 */

import { EventEmitter } from "eventemitter3";
import { setTimeout as wait } from "node:timers/promises";
import type { BadgeWrappedEvent } from "@ssi/sdk";

const HORIZON = process.env.STELLAR_HORIZON_URL ?? "";

export class HorizonStream extends EventEmitter {
  private cursor: string | undefined;

  async *iter(trigger: string): AsyncGenerator<{ cursor: string; event: any }> {
    while (true) {
      const url = new URL(`${HORIZON}/events?topic=${trigger}` +
        (this.cursor ? `&cursor=${this.cursor}` : ""));
      const res = await fetch(url, { headers: { Accept: "text/event-stream" } });
      if (!res.ok || !res.body) {
        await wait(1000);
        continue;
      }
      // SSE implementation left as a TODO for the scaffold
      // (Node fetch + SSE requires manual parsing)
      void res;
      await wait(5000);
    }
  }
}

const stream = new HorizonStream();
export async function startHorizonStream() {
  stream.iter("contract").on?.("event", (e) => {
    // forward to ws clients of the api-gateway
    void e;
  });
}
