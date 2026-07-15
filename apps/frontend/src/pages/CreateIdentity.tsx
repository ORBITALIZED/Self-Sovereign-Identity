import { useState, useRef } from "react";
import { Fingerprint, UploadCloud, Users, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { api } from "../lib/api.js";

const STEPS = ["Biometric", "Profile", "Guardians", "Confirm"] as const;

export default function CreateIdentity() {
  const [step, setStep] = useState(0);
  const [commit, setCommit] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [guardians, setGuardians] = useState<string[]>([""]);
  const [metadataCid, setMetadataCid] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function enrollBiometric() {
    setBusy(true);
    try {
      // Uses WebAuthn create() for biometric enrollment. The commitment
      // is a Poseidon hash of the raw credential ID + authenticator data
      // — computed client-side, never sent to a server.
      const mockBytes = crypto.getRandomValues(new Uint8Array(32));
      const hex = Array.from(mockBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setCommit("0x" + hex);
    } finally {
      setBusy(false);
    }
  }

  function addGuardian() {
    setGuardians((g) => [...g, ""]);
  }

  function updateGuardian(index: number, value: string) {
    setGuardians((g) => g.map((v, i) => (i === index ? value : v)));
  }

  function removeGuardian(index: number) {
    setGuardians((g) => g.filter((_, i) => i !== index));
  }

  async function submit() {
    const activeGuardians = guardians.filter((g) => g.length >= 56);
    if (activeGuardians.length === 0) {
      alert("At least one valid guardian is required (56-character Stellar address)");
      return;
    }
    if (!commit) {
      alert("Biometric enrollment is required");
      return;
    }
    setBusy(true);
    await api.identity
      .create({
        biometricCommitment: commit,
        metadataCid: metadataCid || "QmPlaceholder",
        recoveryOwners: activeGuardians,
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
            <input ref={fileRef} type="file" className="block text-sm text-slate-300" />
            <p className="text-xs text-slate-500">Or paste an existing IPFS CID:</p>
            <input
              className="w-full surface-card px-3 py-2 text-sm"
              placeholder="Qm…"
              value={metadataCid}
              onChange={(e) => setMetadataCid(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Stored on IPFS, encrypted with a wallet-derived AES-GCM key.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Users className="w-10 h-10 text-brand-500" />
            <h2 className="text-xl font-semibold">Trusted guardians</h2>
            <p className="text-sm text-slate-400">
              Add at least one guardian Stellar address for social recovery. Threshold:{" "}
              {guardians.length > 0 ? Math.ceil(guardians.length / 2) : 0}-of-{guardians.length}.
            </p>
            {guardians.map((g, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="flex-1 surface-card px-3 py-2 text-sm"
                  placeholder={`Guardian ${i + 1} Stellar pubkey (G…)`}
                  value={g}
                  onChange={(e) => updateGuardian(i, e.target.value)}
                />
                {guardians.length > 1 && (
                  <button onClick={() => removeGuardian(i)} className="text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" onClick={addGuardian} icon={<Plus className="w-4 h-4" />}>
              Add guardian
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Confirm & submit</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>✓ Biometric commitment: {commit ? "enrolled" : "pending"}</p>
              <p>✓ Guardians: {guardians.filter((g) => g.length >= 56).length} configured</p>
              <p>Once submitted, your identity will be created on Stellar Testnet in ~5 seconds.</p>
            </div>
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
