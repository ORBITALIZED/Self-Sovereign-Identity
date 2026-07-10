/**
 * Typed HTTP client for the SSI API gateway.
 */

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  identity: {
    async getMe(): Promise<{ identity: import("@ssi/sdk").Identity } | null> {
      const r = await fetch(`${BASE}/identity/me`);
      if (r.status === 404) return null;
      return j(r);
    },
    async create(body: {
      biometricCommitment: string;
      metadataCid: string;
      recoveryOwners: string[];
    }) {
      const r = await fetch(`${BASE}/identity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return j<{ txHash: string }>(r);
    },
  },
  credentials: {
    async list(subject: string) {
      return j<unknown[]>(await fetch(`${BASE}/credentials/${encodeURIComponent(subject)}`));
    },
  },
  fraud: {
    async score(subject: string) {
      return j<{ score: number }>(
        await fetch(`${BASE}/fraud/score`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject }),
        }),
      );
    },
  },
};
