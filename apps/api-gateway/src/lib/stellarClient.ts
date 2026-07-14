/**
 * Shared Stellar SDK singleton — lazily constructed on first use so the
 * gateway can boot (and serve /health, /ready, /bridge/wrapped) even
 * when STELLAR_HORIZON_URL is not configured.
 *
 * Used by identity.ts, credentials.ts and any future route files that
 * need Soroban access.
 */

import { SSIStellar } from "@ssi/sdk";

function buildStellar(): SSIStellar | null {
  const horizonUrl = process.env.STELLAR_HORIZON_URL;
  if (!horizonUrl) return null;

  return new SSIStellar({
    horizonUrl,
    rpcUrl: process.env.STELLAR_SOROBAN_RPC_URL ?? "",
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? "",
    identityContractId: process.env.STELLAR_IDENTITY_CONTRACT ?? "",
    wrappedBadgeContractId: process.env.STELLAR_WRAPPED_BADGE_CONTRACT ?? "",
    sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL,
  });
}

/** Cached per-process SDK instance. */
let _stellar: SSIStellar | null | undefined;

/** Return the shared SSIStellar client, or null if Stellar is not configured. */
export function getStellar(): SSIStellar | null {
  if (_stellar === undefined) _stellar = buildStellar();
  return _stellar;
}
