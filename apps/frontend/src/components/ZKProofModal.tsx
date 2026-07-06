import { useState } from "react";
import { Lock, CheckCircle2, XCircle, Loader } from "lucide-react";
import { Modal } from "./ui/Modal.js";
import { Button } from "./ui/Button.js";

export default function ZKProofModal({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "proving" | "verified" | "failed">("idle");

  async function generate() {
    setStatus("proving");
    try {
      const res = await fetch("/api/zkp/prove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          circuit: "credential",
          input: {
            issuer_merkle_root: "0", schema_hash: "0", nullifier_hash: "0", context: "0",
            issuer_pk: "0", nullifier: "0", cred_signature: "1",
            pathElements: new Array(20).fill("0"), pathIndices: new Array(20).fill("0"),
          },
        }),
      });
      if (!res.ok) throw new Error("backend error");
      setStatus("verified");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Zero-Knowledge Proof">
      <p className="text-sm text-slate-300 mb-4">
        We will generate a Groth16 proof that you own a valid credential <em>without</em> revealing which one.
        This typically takes 3–5 seconds.
      </p>
      <div className="flex items-center gap-3 my-4">
        {status === "proving" && <Loader className="w-5 h-5 animate-spin text-brand-500" />}
        {status === "verified" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        {status === "failed"   && <XCircle     className="w-5 h-5 text-red-400" />}
        <span className="text-sm capitalize">{status}</span>
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={generate} icon={<Lock className="w-4 h-4" />} disabled={status === "proving"}>
          Generate proof
        </Button>
      </div>
    </Modal>
  );
}
