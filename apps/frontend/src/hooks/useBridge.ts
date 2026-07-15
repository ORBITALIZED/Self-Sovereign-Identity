import { useEffect, useState, useRef } from "react";

export interface BridgeEvent {
  id: string;
  subject: string;
  sourceChainId: number;
  sourceTxHash: string;
  assetCode: string;
  ts: number;
}

const SSE_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/bridge/events/stream`;

export function useBridge() {
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      eventSource = new EventSource(SSE_URL);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (msg: MessageEvent<string>) => {
        try {
          const ev = JSON.parse(msg.data) as BridgeEvent;
          if (!seenIds.current.has(ev.id)) {
            seenIds.current.add(ev.id);
            setEvents((prev) => [ev, ...prev].slice(0, 100));
          }
        } catch {
          // Malformed JSON — skip silently.
        }
      };

      // EventSource auto-reconnects on connection loss with built-in
      // exponential backoff. We just track the connectivity state.
      eventSource.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  return { events, connected };
}
