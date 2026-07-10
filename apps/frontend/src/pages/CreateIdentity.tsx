import { useState } from "react";
import { Fingerprint, UploadCloud, Users } from "lucide-react";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { api } from "../lib/api.js";

const STEPS = ["Biometric", "Profile", "Guardians", "Confirm"] as const;

export default function CreateIdentity() {
  const [step, setStep] = useState(0);
  const [commit, setCommit] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function enrollBiometric() {
    setBusy(true);
    try {
      // real implementation uses @simplewebauthn/webauthn-prompts
      await new Promise((r) => setTimeout(r, 1200));
      setCommit(
        "0x" +
          Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 256)
              .toString(16)
              .padStart(2, "0"),
          ).join(""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    await api.identity
      .create({
        biometricCommitment: commit,
        metadataCid: "QmPlaceholder",
        recoveryOwners: ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"],
      })
      .finally(() => setBusy(false));
  }

  return (
    <Card className="p-0 overflow-hidden max-w-2xl mx-auto">
      <header className="px-6 py-4 border-b border-surface-700">
        <h1 className="text-lg font-semibold">Create a new identity</h1>
        <Stepper current={step} />
      </header>

      <div className="px-6 py-8 min-h-[280px]">
        {step === 0 && (
          <div className="text-center space-y-4">
            <Fingerprint className="w-16 h-16 mx-auto text-brand-500" />
            <h2 className="text-xl font-semibold">Enroll biometric</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Your device's secure enclave will hash the biometric locally; only the commitment ever
              leaves the device.
            </p>
            <Button onClick={enrollBiometric} loading={busy}>
              Capture
            </Button>
            {commit && (
              <code className="block text-xs text-slate-300">commit: {commit.slice(0, 22)}…</code>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <UploadCloud className="w-10 h-10 text-brand-500" />
            <h2 className="text-xl font-semibold">Encrypted profile</h2>
            <input type="file" className="block text-sm text-slate-300" />
            <p className="text-xs text-slate-500">
              Stored on IPFS, encrypted with a wallet-derived AES-GCM key.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Users className="w-10 h-10 text-brand-500" />
            <h2 className="text-xl font-semibold">Trusted guardians</h2>
            <input
              className="w-full surface-card px-3 py-2 text-sm"
              placeholder="Guardian Stellar pubkey (G…)"
            />
            <input
              className="w-full surface-card px-3 py-2 text-sm"
              placeholder="Another guardian (optional)"
            />
            <p className="text-xs text-slate-500">2-of-3 guardian recovery will be enabled.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Confirm & submit</h2>
            <p className="text-sm text-slate-300">
              Once submitted, your identity will be created on Stellar Testnet in ~5 seconds.
            </p>
            <Button onClick={submit} loading={busy}>
              Submit to Soroban
            </Button>
          </div>
        )}
      </div>

      <footer className="px-6 py-3 border-t border-surface-700 flex justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        <Button
          onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
          disabled={step === STEPS.length - 1}
        >
          Next
        </Button>
      </footer>
    </Card>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex gap-3 mt-3 text-xs">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={`flex items-center gap-1 ${i === current ? "text-brand-500" : "text-slate-500"}`}
        >
          <span
            className={`h-1.5 w-6 rounded-full ${i <= current ? "bg-brand-500" : "bg-surface-700"}`}
          />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
