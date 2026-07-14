import { useBridge } from "../hooks/useBridge.js";
import { ArrowRight, Activity } from "lucide-react";
import { Card } from "./ui/Card.js";

const CHAIN_LABELS: Record<number, string> = {
  1: "Ethereum",
  137: "Polygon",
  80002: "Polygon Amoy",
  1700: "Stellar Public",
};

export default function BridgeMonitor() {
  const { events, connected } = useBridge();

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" /> Live bridge events
        </h2>
        <span
          className={`text-xs flex items-center gap-2 ${
            connected ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          <span className={`pulse-dot ${!connected ? "opacity-50" : ""}`} />
          {connected ? "streaming" : "connecting..."}
        </span>
      </div>

      <div className="divide-y divide-surface-700 max-h-[420px] overflow-auto">
        {events.length === 0 && (
          <div className="px-6 py-8 text-sm text-slate-400">
            {connected
              ? "Waiting for the first wrapped badge…"
              : "Connecting to bridge relay…"}
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="px-6 py-3 flex items-center gap-3 text-sm">
            <span className="font-mono text-slate-200">
              {e.subject.slice(0, 4)}…{e.subject.slice(-4)}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <span className="text-brand-500">
              {CHAIN_LABELS[e.sourceChainId] ?? `Chain ${e.sourceChainId}`}
            </span>
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
