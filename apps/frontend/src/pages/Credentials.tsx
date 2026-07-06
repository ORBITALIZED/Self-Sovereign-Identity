import { useState } from "react";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import ZKProofModal from "../components/ZKProofModal.js";
import { Lock, GraduationCap, Briefcase, HeartPulse } from "lucide-react";

export default function Credentials() {
  const [open, setOpen] = useState(false);

  const list = [
    { icon: <GraduationCap className="w-4 h-4" />, title: "Universidad de los Andes — BSc Computer Science", year: 2022, status: "valid"   },
    { icon: <Briefcase    className="w-4 h-4" />, title: "Acme — Senior Engineer Letter",                year: 2024, status: "valid"   },
    { icon: <HeartPulse   className="w-4 h-4" />, title: "Hospital San Ignacio — Vaccination record",   year: 2025, status: "valid"   },
    { icon: <Lock         className="w-4 h-4" />, title: "Age over 18",                                  year: 2025, status: "zkProof" },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        {list.map((c) => (
          <Card key={c.title} className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-brand-700/30 text-brand-500">{c.icon}</div>
            <div className="flex-1">
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-slate-500">Issued {c.year}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${c.status === "valid" ? "bg-emerald-700/30 text-emerald-300" : "bg-brand-700/30 text-brand-300"}`}>
              {c.status}
            </span>
            {c.status === "zkProof" && (
              <Button size="sm" onClick={() => setOpen(true)} icon={<Lock className="w-3 h-3" />}>Present proof</Button>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-2">Selective disclosure</h3>
        <p className="text-sm text-slate-400">
          Generate a ZK proof that you satisfy a verifier's policy (e.g. "has any bachelor's degree issued after 2020")
          without revealing the credential itself.
        </p>
        <Button className="mt-4" onClick={() => setOpen(true)} icon={<Lock className="w-4 h-4" />}>
          New ZK proof
        </Button>
      </Card>

      <ZKProofModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
