import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Identity } from "@ssi/sdk";
import { api } from "../lib/api.js";

interface GetMeResponse {
  identity: Identity;
}

export function useIdentity() {
  const qc = useQueryClient();
  const query = useQuery<GetMeResponse | null>({
    queryKey: ["identity"],
    queryFn: () => api.identity.getMe().catch(() => null),
  });

  const create = useMutation({
    mutationFn: api.identity.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity"] }),
  });

  return { query, create };
}
