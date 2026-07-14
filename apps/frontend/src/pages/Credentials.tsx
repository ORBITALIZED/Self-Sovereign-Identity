import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import ZKProofModal from "../components/ZKProofModal.js";
import { Lock, GraduationCap, Briefcase, HeartPulse } from "lucide-react";
import { api } from "../lib/api.js";

const ICONS: Record<string, React.ReactNode> = {
  education: <GraduationCap className="w-4 h-4" />,
  employment: <Briefcase className="w-4 h-4" />,
  medical: <HeartPulse className="w-4 h-4" />,
  default: <Lock className="w-4 h-4" />,
};

interface CredentialItem {
  id: string;
  kind: string;
  title: string;
  year: number;
  status: string;
}

export default function Credentials() {
  const [open, setOpen] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ["credentials-page"],
    queryFn: async (): Promise<CredentialItem[]> => {
      try {
        const res = await fetch("/api/credentials");
        if (!res.ok) return [];
        return (await res.json()) as CredentialItem[];
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        {isLoading && (
          <Card className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="w-full" height="h-16" />
            ))}
          </Card>
        )}
        {list && list.length === 0 && !isLoading && (
          <Card className="p-6">
            <p className="text-slate-400 text-sm">No credentials issued yet.</p>
          </Card>
        )}
        {list?.map((c) => (
          <Card key={c.id} className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-brand-700/30 text-brand-500">
              {ICONS[c.kind] ?? ICONS.default}
            </div>
            <div className="flex-1">
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-slate-500">Issued {c.year}</div>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                c.status === "valid"
                  ? "bg-emerald-700/30 text-emerald-300"
                  : "bg-brand-700/30 text-brand-300"
              }`}
            >
              {c.status}
            </span>
            {c.status === "zkProof" && (
              <Button size="sm" onClick={() => setOpen(true)} icon={<Lock className="w-3 h-3" />}>
                Present proof
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-2">Selective disclosure</h3>
        <p className="text-sm text-slate-400">
          Generate a ZK proof that you satisfy a verifier's policy (e.g. "has any bachelor's degree
          issued after 2020") without revealing the credential itself.
        </p>
        <Button className="mt-4" onClick={() => setOpen(true)} icon={<Lock className="w-4 h-4" />}>
          New ZK proof
        </Button>
      </Card>

      <ZKProofModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
