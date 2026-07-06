import BridgeMonitorComponent from "../components/BridgeMonitor.js";
import { Card } from "../components/ui/Card.js";

export default function BridgePage() {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <BridgeMonitorComponent />
      </div>
      <Card className="p-6">
        <h3 className="font-semibold mb-2">How the bridge works</h3>
        <ol className="text-sm text-slate-300 list-decimal list-inside space-y-2">
          <li>An issuer mints a soulbound badge on Polygon / Ethereum.</li>
          <li>The relayer observes the on-chain <code>BadgeLocked</code> event.</li>
          <li>AI fraud service scores the issuer + holder pair.</li>
          <li>Relayer calls Soroban <code>WrappedBadge.wrap_badge</code>.</li>
          <li>A Stellar-native asset appears in the holder's wallet in &lt; 5s.</li>
        </ol>
      </Card>
    </div>
  );
}
