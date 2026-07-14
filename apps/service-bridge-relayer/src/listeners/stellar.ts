/**
 * Stellar-side listener: polls Horizon for Soroban contract events
 * and re-broadcasts them on the internal event bus.
 */

import { EventEmitter } from "eventemitter3";
import { setTimeout as wait } from "node:timers/promises";

export const stellarBus = new EventEmitter();

export async function startStellarListener() {
  const HORIZON = process.env.STELLAR_HORIZON_URL!;
  const CONTRACT = process.env.STELLAR_IDENTITY_CONTRACT;

  let lastCursor: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const url =
        `${HORIZON}/contracts/${CONTRACT}/events?limit=200` +
        (lastCursor ? `&cursor=${lastCursor}` : "");
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        await wait(5000);
        continue;
      }
      const body: any = await res.json();

      for (const ev of body?._embedded?.records ?? []) {
        switch (ev.topic?.[0]) {
          case "identity_created":
            stellarBus.emit("identity_created", ev);
            break;
          case "credential_issued":
            stellarBus.emit("credential_issued", ev);
            break;
          case "badge_wrapped":
            stellarBus.emit("badge_wrapped", ev);
            break;
          case "recovery_complete":
            stellarBus.emit("recovery_complete", ev);
            break;
        }
        lastCursor = ev.paging_token;
      }
      await wait(2000);
    } catch (e) {
      console.error("stellar listener", e);
      await wait(5000);
    }
  }
}

// Helper that other modules can subscribe to (subscribed inside the relayer loop)
export function onIdentityCreated(cb: (ev: any) => void) {
  stellarBus.on("identity_created", cb);
}
export function onBadgeWrapped(cb: (ev: any) => void) {
  stellarBus.on("badge_wrapped", cb);
}
