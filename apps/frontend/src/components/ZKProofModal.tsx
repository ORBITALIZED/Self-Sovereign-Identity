import { useState } from "react";
import { Lock, CheckCircle2, XCircle, Loader } from "lucide-react";
import { Modal } from "./ui/Modal.js";
import { Button } from "./ui/Button.js";

/** Default circuit inputs loaded from packages/zk-circuits/input.json */
const DEFAULT_INPUT = {
  issuer_merkle_root:
    "10864377886884680290326330895609475060077342672060485977100635376428187293617",
  schema_hash: "19260139964230784517876035663687083462605068138915998157934766168375692798834",
  nullifier_hash: "4498579144080405581899059964769219537004567421581296270470786331505602257656",
  context: "9846372918473629103847561029384756102938475610293847561029384756102938",
  issuer_pk: "19637352962541647957958218203351256706062647137593109877568302582026149416373",
  nullifier: "1724365819283746501928374650192837465019283746501928374650192837465",
  cred_signature: "1",
  pathElements: new Array(20).fill(
    "19637352962541647957958218203351256706062647137593109877568302582026149416373",
  ),
  pathIndices: new Array(20).fill("0"),
};

export default function ZKProofModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "proving" | "verified" | "failed">("idle");

  async function generate() {
    setStatus("proving");
    try {
      const res = await fetch("/api/zkp/prove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          circuit: "credential",
          input: DEFAULT_INPUT,
        }),
      });
      if (!res.ok) throw new Error(`backend error ${res.status}`);
      setStatus("verified");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Zero-Knowledge Proof">
      <p className="text-sm text-slate-300 mb-4">
        We will generate a Groth16 proof that you own a valid credential <em>without</em> revealing
        which one. This typically takes 3–5 seconds.
      </p>
      <div className="flex items-center gap-3 my-4">
        {status === "proving" && <Loader className="w-5 h-5 animate-spin text-brand-500" />}
        {status === "verified" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        {status === "failed" && <XCircle className="w-5 h-5 text-red-400" />}
        <span className="text-sm capitalize">{status}</span>
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={generate}
          icon={<Lock className="w-4 h-4" />}
          disabled={status === "proving"}
        >
          Generate proof
        </Button>
      </div>
    </Modal>
  );
}
