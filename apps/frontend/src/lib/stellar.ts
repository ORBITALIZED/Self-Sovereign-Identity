/**
 * Stellar SDK wrapper used by the frontend.
 *
 * Lazy-imports the underlying SDK so the bundle stays small and the page
 * can still render when the SDK is unreachable (e.g. preview environments).
 */

import type { StellarPubKey } from "@ssi/sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sdk: any | undefined;
const STELLAR_SDK_PKG = "@stellar/stellar-sdk";

async function sdk(): Promise<any> {
  if (!_sdk) {
    try {
      _sdk = await import(STELLAR_SDK_PKG);
    } catch {
      // @stellar/stellar-sdk may not be available in all environments
      _sdk = null;
    }
  }
  return _sdk;
}

export async function horizon() {
  const s = await sdk();
  if (!s) throw new Error("Stellar SDK not available");
  return new s.Horizon.Server(
    import.meta.env.VITE_STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  );
}

export async function fundTestnet(addr: StellarPubKey): Promise<void> {
  void addr;
  void (await sdk());
  // TODO: use Friendbot HTTP endpoint
}
