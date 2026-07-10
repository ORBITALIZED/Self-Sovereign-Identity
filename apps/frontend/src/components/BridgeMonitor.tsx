import { useEffect, useState } from "react";
import { ArrowRight, Activity } from "lucide-react";
import { Card } from "./ui/Card.js";

interface Event {
  id: string;
  subject: string;
  sourceChainId: number;
  sourceTxHash: string;
  assetCode: string;
  ts: number;
}

const FAKE_CHAIN: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  80002: "Polygon Amoy",
  1700: "Stellar Public",
};

export default function BridgeMonitor() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    // TODO: connect to Horizon SSE — placeholder buffer for the scaffold
    const t = setInterval(() => {
      const e: Event = {
        id: Math.random().toString(36).slice(2, 10),
        subject:
          "G" +
          Math.random()
            .toString(36)
            .toUpperCase()
            .repeat(55 / 36)
            .slice(0, 55),
        sourceChainId: 80002,
        sourceTxHash: Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64),
        assetCode: "WID-" + Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0"),
        ts: Date.now(),
      };
      setEvents((xs) => [e, ...xs].slice(0, 30));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" /> Live bridge events
        </h2>
        <span className="text-xs text-emerald-400 flex items-center gap-2">
          <span className="pulse-dot" /> streaming
        </span>
      </div>

      <div className="divide-y divide-surface-700 max-h-[420px] overflow-auto">
        {events.length === 0 && (
          <div className="px-6 py-8 text-sm text-slate-400">
            Waiting for the first wrapped badge…
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="px-6 py-3 flex items-center gap-3 text-sm">
            <span className="font-mono text-slate-200">
              {e.subject.slice(0, 4)}…{e.subject.slice(-4)}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <span className="text-brand-500">{FAKE_CHAIN[e.sourceChainId] ?? e.sourceChainId}</span>
            <span className="text-xs text-slate-500">via</span>
            <code className="text-xs text-slate-300">{e.assetCode}</code>
            <span className="ml-auto text-xs text-slate-500">
              {new Date(e.ts).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
