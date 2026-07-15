import { useState } from "react";
import { ShieldCheck, Fingerprint, KeyRound, Copy, Check } from "lucide-react";
import { Card } from "./ui/Card.js";
import { Button } from "./ui/Button.js";
import type { Identity } from "@ssi/sdk";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-slate-400 hover:text-slate-200 transition-colors"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export default function IdentityCard({
  identity,
  onRotate,
}: {
  identity: Identity;
  onRotate?: () => void;
}) {
  const fullHex = (b: Uint8Array) =>
    Array.from(b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  const short = (b: Uint8Array) => fullHex(b).slice(0, 12) + "…";
  const pubkeyHex = fullHex(identity.pubkey);
  const bioHex = fullHex(identity.biometricCommitment);

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
        <Stat
          icon={<KeyRound className="w-4 h-4" />}
          label="PubKey"
          value={short(identity.pubkey)}
          action={<CopyButton text={pubkeyHex} />}
        />
        <Stat
          icon={<Fingerprint className="w-4 h-4" />}
          label="Biometric"
          value={short(identity.biometricCommitment)}
          action={<CopyButton text={bioHex} />}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400 uppercase">Encrypted profile (IPFS)</span>
          <CopyButton text={identity.metadataCid} />
        </div>
        <a
          href={`https://ipfs.io/ipfs/${identity.metadataCid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block surface-card px-3 py-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          {identity.metadataCid}
        </a>
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

function Stat({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-card p-3">
      <div className="text-xs text-slate-400 uppercase flex items-center gap-1 justify-between">
        <span className="flex items-center gap-1">
          {icon} {label}
        </span>
        {action}
      </div>
      <div className="font-mono text-slate-200 text-sm mt-1">{value}</div>
    </div>
  );
}
