/**
 * Stellar client — wraps Horizon (read-only) and Soroban RPC (write).
 *
 * Lazy-loads the underlying `stellar-sdk` modules so the SDK can be imported
 * in browser contexts without Node-only deps.
 */

import { ChainConnectionError } from "../errors.js";
import type { ChainConfig, StellarPubKey, Identity, Credential, WrappedBadge } from "../types/index.js";

let _stellar: typeof import("@stellar/stellar-sdk") | undefined;

async function stellar() {
  if (!_stellar) _stellar = await import("@stellar/stellar-sdk");
  return _stellar;
}

export interface StellarClientConfig extends ChainConfig {
  identityContractId: string;
  wrappedBadgeContractId: string;
  /** Optional: soroban RPC URL for invokeContract calls */
  sorobanRpcUrl?: string;
}

export class SSIStellar {
  constructor(public readonly config: StellarClientConfig) {
    if (!config.horizonUrl) throw new ChainConnectionError("stellar", config.horizonUrl);
  }

  identity   = new IdentitySubClient(this);
  wrappedBadge = new WrappedBadgeSubClient(this);
  credentials  = new CredentialsSubClient(this);

  /** Open a Horizon server. */
  async horizon() {
    const s = await stellar();
    return new s.Horizon.Server(this.config.horizonUrl, {
      allowHttp: this.config.horizonUrl.startsWith("http://"),
    });
  }

  /** Open a Soroban RPC client (for invoking contracts). */
  async soroban() {
    const s = await stellar();
    if (!this.config.sorobanRpcUrl) {
      throw new Error("sorobanRpcUrl is required for invoke calls");
    }
    return new s.SorobanRpc.Server(this.config.sorobanRpcUrl, {
      allowHttp: this.config.sorobanRpcUrl.startsWith("http://"),
    });
  }
}

// ---------------------------------------------------------------------------
// IdentityRegistry sub-client
// ---------------------------------------------------------------------------
class IdentitySubClient {
  constructor(private parent: SSIStellar) {}

  /** READ-ONLY — fetch an Identity record. */
  async get(pubkey: StellarPubKey): Promise<Identity | null> {
    const s = await stellar();
    const rpc = await this.parent.soroban();
    const ledgerKey = s.xdr.ScVal.scvLedgerKeyContractData();
    // TODO: build the actual contract-data key for (this.parent.config.identityContractId, "Identity", pubkey)
    //       For the scaffold we return null to keep the API compileable.
    void ledgerKey; void rpc;
    return null;
  }

  // WRITE helpers — submit a Soroban invoke tx (skeleton, signs offline)
  async create(_args: {
    pubkey: StellarPubKey;
    biometricCommitment: Uint8Array;
    metadataCid: string;
    recoveryOwners: StellarPubKey[];
    signerSecret: string;
  }): Promise<string> {
    // TODO: build invokeHostFunctionOp, simulate, assemble, sign & submit
    throw new Error("not implemented yet — see TODO");
  }
}

// ---------------------------------------------------------------------------
// WrappedBadge sub-client
// ---------------------------------------------------------------------------
class WrappedBadgeSubClient {
  constructor(private parent: SSIStellar) {}

  async get(_subject: StellarPubKey, _chainId: number, _txHash: Uint8Array): Promise<WrappedBadge | null> {
    void this.parent;
    return null; // scaffold
  }
}

// ---------------------------------------------------------------------------
// Credentials sub-client
// ---------------------------------------------------------------------------
class CredentialsSubClient {
  constructor(private parent: SSIStellar) {}

  async list(_subject: StellarPubKey): Promise<Credential[]> {
    void this.parent;
    return [];
  }
}
