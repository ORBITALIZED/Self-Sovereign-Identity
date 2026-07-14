import { useEffect, useState, useRef } from "react";

interface BridgeEvent {
  id: string;
  subject: string;
  sourceChainId: number;
  sourceTxHash: string;
  assetCode: string;
  ts: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function useBridge() {
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cursor: string | undefined;
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const url = new URL(`${API_BASE}/api/bridge/wrapped`);
        url.searchParams.set("limit", "30");
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json() as {
          events: BridgeEvent[];
          nextCursor: string | null;
          error?: string;
        };

        if (data.error) return;

        setConnected(true);
        if (data.events.length > 0) {
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            const fresh = data.events.filter((e) => !seen.has(e.id));
            return [...fresh, ...prev].slice(0, 100);
          });
        }
        cursor = data.nextCursor ?? undefined;
      } catch {
        setConnected(false);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000) as unknown as ReturnType<typeof setInterval>;

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current as unknown as ReturnType<typeof setInterval>);
    };
  }, []);

  return { events, connected };
}
