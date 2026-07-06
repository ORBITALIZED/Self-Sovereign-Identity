import { ShieldCheck, Fingerprint, KeyRound, Copy } from "lucide-react";
import { Card } from "./ui/Card.js";
import { Button } from "./ui/Button.js";
import type { Identity } from "@ssi/sdk";

export default function IdentityCard({ identity, onRotate }: { identity: Identity; onRotate?: () => void }) {
  const short = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12);
  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-500" /> Your Identity
        </h2>
        <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
          <span className="pulse-dot" /> Active on-chain
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Stat icon={<KeyRound className="w-4 h-4" />}  label="PubKey"        value={short(identity.pubkey) + "…"} />
        <Stat icon={<Fingerprint className="w-4 h-4" />} label="Biometric" value={short(identity.biometricCommitment) + "…"} />
      </div>

      <div>
        <div className="text-xs text-slate-400 uppercase mb-1">Encrypted profile (IPFS)</div>
        <code className="block surface-card px-3 py-2 text-xs">{identity.metadataCid}</code>
      </div>

      {onRotate && (
        <div className="flex gap-2 mt-2">
          <Button onClick={onRotate} variant="secondary" icon={<Copy className="w-4 h-4" />}>
            Rotate biometric
          </Button>
        </div>
      )}
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card p-3">
      <div className="text-xs text-slate-400 uppercase flex items-center gap-1">{icon} {label}</div>
      <div className="font-mono text-slate-200 text-sm mt-1">{value}</div>
    </div>
  );
}
