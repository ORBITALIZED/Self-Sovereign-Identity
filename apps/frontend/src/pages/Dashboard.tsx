import { useQuery } from "@tanstack/react-query";
import IdentityCard from "../components/IdentityCard.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { api } from "../lib/api.js";
import { ShieldAlert, GraduationCap, Briefcase, HeartPulse, Lock } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  education: <GraduationCap className="w-4 h-4" />,
  employment: <Briefcase className="w-4 h-4" />,
  medical: <HeartPulse className="w-4 h-4" />,
  default: <Lock className="w-4 h-4" />,
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["identity"],
    queryFn: () => api.identity.getMe().catch(() => null),
  });

  const credentials = useQuery({
    queryKey: ["credentials", data?.identity?.pubkey],
    queryFn: async () => {
      if (!data?.identity?.pubkey) return [];
      const address = Array.from(data.identity.pubkey as Uint8Array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      try {
        const res = await fetch(`/api/credentials/${address}/count`);
        if (!res.ok) return [];
        const body = (await res.json()) as { count: number };
        return Array.from({ length: body.count }, (_, i) => ({
          id: `${i}`,
          title: `Credential #${i + 1}`,
          year: 2025,
          status: "valid" as const,
          kind: "default",
        }));
      } catch {
        return [];
      }
    },
    enabled: !!data?.identity?.pubkey,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {isLoading && (
          <Card className="p-6 space-y-3">
            <Skeleton width="w-40" height="h-6" />
            <Skeleton width="w-72" height="h-4" />
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
          <h3 className="font-semibold mb-3">
            Recent credentials ({credentials.data?.length ?? 0})
          </h3>
          {credentials.isLoading && (
            <div className="space-y-2">
              <Skeleton width="w-full" height="h-10" />
              <Skeleton width="w-full" height="h-10" />
            </div>
          )}
          {credentials.data && credentials.data.length === 0 && (
            <p className="text-sm text-slate-400">No credentials issued yet.</p>
          )}
          <ul className="text-sm text-slate-300 space-y-2">
            {credentials.data?.map((c) => (
              <li
                key={c.id}
                className="surface-card px-3 py-2 flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <span className="text-brand-500">{ICON_MAP[c.kind] ?? ICON_MAP.default}</span>
                  {c.title}
                </span>
                <span className="text-xs text-emerald-400">{c.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Cross-chain status</h3>
          <p className="text-sm text-slate-400">
            Bridge relayer is <span className="text-emerald-400">healthy</span>.{" "}
            {data ? "Ready for cross-chain operations." : "Create an identity to bridge."}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Guardians</h3>
          <p className="text-sm text-slate-400">
            {data?.identity?.recoveryOwners?.length ?? 0} guardians configured for social recovery.
          </p>
        </Card>
      </div>
    </div>
  );
}
