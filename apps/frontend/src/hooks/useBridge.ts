import { useEffect, useState } from "react";

interface BridgeEvent {
  id: string;
  subject: string;
  sourceChainId: number;
  sourceTxHash: string;
  assetCode: string;
  ts: number;
}

export function useBridge() {
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // TODO: open EventSource('/api/bridge/ws') when backend exposes SSE
    setConnected(false);
    return () => {};
  }, []);

  return { events, connected };
}
