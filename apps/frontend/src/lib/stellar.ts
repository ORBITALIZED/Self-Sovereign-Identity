/**
 * Stellar SDK wrapper used by the frontend.
 *
 * Lazy-imports the underlying SDK so the bundle stays small and the page
 * can still render when the SDK is unreachable (e.g. preview environments).
 */

import type { StellarPubKey } from "@ssi/sdk";

let _sdk: typeof import("@stellar/stellar-sdk") | undefined;

async function sdk() {
  if (!_sdk) _sdk = await import("@stellar/stellar-sdk");
  return _sdk;
}

export async function horizon() {
  const s = await sdk();
  return new s.Horizon.Server(
    import.meta.env.VITE_STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  );
}

export async function fundTestnet(addr: StellarPubKey): Promise<void> {
  void addr; void (await sdk());
  // TODO: use Friendbot HTTP endpoint
}
