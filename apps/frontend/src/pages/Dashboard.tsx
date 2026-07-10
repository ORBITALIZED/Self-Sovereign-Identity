import { useQuery } from "@tanstack/react-query";
import IdentityCard from "../components/IdentityCard.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { api } from "../lib/api.js";
import { ShieldAlert } from "lucide-react";

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["identity"],
    queryFn: () => api.identity.getMe().catch(() => null),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {isLoading && (
          <Card className="p-6 animate-pulse">
            <div className="h-6 w-40 bg-surface-700 rounded mb-4" />
            <div className="h-4 w-72 bg-surface-700 rounded" />
          </Card>
        )}

        {data && <IdentityCard identity={data.identity} />}

        {!data && !isLoading && (
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-yellow-300">
              <ShieldAlert className="w-5 h-5" /> No identity yet
            </div>
            <p className="text-slate-300">
              To start using the platform you need to create a Soroban identity. The process is one
              click: it generates a biometric commitment and uploads an encrypted profile blob to
              IPFS.
            </p>
            <a href="/identity/new">
              <Button>Create identity</Button>
            </a>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-semibold mb-3">Recent credentials</h3>
          <ul className="text-sm text-slate-300 space-y-2">
            {[
              "University degree – Universidad de los Andes",
              "Employment letter – Acme Colombia",
              "KYC passport – gov.br",
            ].map((c) => (
              <li key={c} className="surface-card px-3 py-2 flex justify-between">
                <span>{c}</span>
                <span className="text-xs text-emerald-400">valid</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Cross-chain status</h3>
          <p className="text-sm text-slate-400">
            Bridge relayer is <span className="text-emerald-400">healthy</span>. 0 wrapped badges
            minted this session.
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">AI fraud score</h3>
          <p className="text-sm text-slate-400">
            Last score for you: <span className="text-emerald-400">0.07 (low risk)</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
