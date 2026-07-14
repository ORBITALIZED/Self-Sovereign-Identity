import BridgeMonitorComponent from "../components/BridgeMonitor.js";
import { Card } from "../components/ui/Card.js";
import { useBridge } from "../hooks/useBridge.js";
import { Activity, Server, AlertTriangle } from "lucide-react";

export default function BridgePage() {
  const { events, connected } = useBridge();

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <BridgeMonitorComponent />
      </div>
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-500" /> How the bridge works
          </h3>
          <ol className="text-sm text-slate-300 list-decimal list-inside space-y-2">
            <li>An issuer mints a soulbound badge on Polygon / Ethereum.</li>
            <li>
              The relayer observes the on-chain <code>BadgeLocked</code> event.
            </li>
            <li>AI fraud service scores the issuer + holder pair.</li>
            <li>
              Relayer calls Soroban <code>WrappedBadge.wrap_badge</code>.
            </li>
            <li>A Stellar-native asset appears in the holder's wallet in &lt; 5s.</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" /> Relayer status
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Stream</span>
              <span className={connected ? "text-emerald-400" : "text-amber-400"}>
                {connected ? "connected" : "reconnecting…"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Events today</span>
              <span className="text-slate-200 font-mono">{events.length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Dead-letter queue
          </h3>
          <p className="text-xs text-slate-400 mb-2">
            Events that failed after 3 retries. Retry manually or investigate.
          </p>
          <div className="text-2xl font-mono font-bold text-amber-300">0</div>
          <p className="text-xs text-slate-500 mt-1">No stuck events</p>
        </Card>
      </div>
    </div>
  );
}
