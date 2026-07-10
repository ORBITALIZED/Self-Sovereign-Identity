/**
 * Stellar client — wraps Horizon (read-only) and Soroban RPC (write).
 *
 * Lazy-loads the underlying `stellar-sdk` modules so the SDK can be imported
 * in browser contexts without Node-only deps.
 */

import { ChainConnectionError } from "../errors.js";
import { bytesToHex } from "../utils/encoding.js";
import type {
  ChainConfig,
  StellarPubKey,
  Identity,
  Credential,
  WrappedBadge,
} from "../types/index.js";

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

  identity = new IdentitySubClient(this);
  wrappedBadge = new WrappedBadgeSubClient(this);
  credentials = new CredentialsSubClient(this);

  /**
   * Submit a pre-signed transaction envelope (base64 XDR) to the Soroban RPC
   * and wait for confirmation.
   *
   * The transaction must already be fully signed (e.g., by Freighter). The
   * gateway simply relays it to the network.
   *
   * @param signedXdrBase64 - Base64-encoded Soroban TransactionEnvelope XDR.
   * @returns The transaction hash (hex string) on success.
   */
  async submitTransaction(signedXdrBase64: string): Promise<string> {
    const rpc = await this.soroban();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendResult: any = await rpc.sendTransaction(signedXdrBase64);

    if (sendResult.status !== "PENDING") {
      throw new Error(
        `Transaction submission failed: ${JSON.stringify(sendResult)}`,
      );
    }

    await pollTransaction(rpc, sendResult.hash);
    return sendResult.hash;
  }

  /** Open a Horizon server. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async horizon(): Promise<any> {
    const s = await stellar();
    return new s.Horizon.Server(this.config.horizonUrl, {
      allowHttp: this.config.horizonUrl.startsWith("http://"),
    });
  }

  /** Open a Soroban RPC client (for invoking contracts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async soroban(): Promise<any> {
    const s = await stellar();
    if (!this.config.sorobanRpcUrl) {
      throw new Error("sorobanRpcUrl is required for invoke calls");
    }
    return new s.SorobanRpc.Server(this.config.sorobanRpcUrl, {
      allowHttp: this.config.sorobanRpcUrl.startsWith("http://"),
    });
  }
}

/** Poll for a Soroban transaction result until it completes or times out. */
async function pollTransaction(rpc: any, hash: string, timeoutMs = 30_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await rpc.getTransaction(hash);
    if (result.status === "SUCCESS") return result;
    if (result.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed: ${JSON.stringify(result)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Transaction ${hash} timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// IdentityRegistry sub-client
// ---------------------------------------------------------------------------
class IdentitySubClient {
  constructor(private parent: SSIStellar) {}

  /**
   * Fetch an Identity record by calling the Soroban contract's `get_identity`
   * function via transaction simulation (read-only).
   */
  async get(pubkey: StellarPubKey): Promise<Identity | null> {
    const s = await stellar();
    const rpc = await this.parent.soroban();

    const contractId = this.parent.config.identityContractId;
    if (!contractId) throw new Error("identityContractId is not configured");

    const contract = new s.Contract(contractId);
    const pkScVal = s.nativeToScVal(pubkey, { type: "bytes" });
    const op = contract.call("get_identity", pkScVal);

    // Use a placeholder account for read-only simulation
    const nullAccount = new s.Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0",
    );

    const tx = new s.TransactionBuilder(nullAccount, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    if (!simResult.result || !simResult.result.retval) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const native: Record<string, any> = s.scValToNative(simResult.result.retval);

    if (!native) {
      return null;
    }

    return {
      pubkey: native["pubkey"] as Uint8Array,
      biometricCommitment: native["biometric_commitment"] as Uint8Array,
      metadataCid: native["metadata_cid"] as string,
      recoveryOwners: Array.from(native["recovery_owners"] as Uint8Array[]),
      createdAt: Number(native["created_at"]),
      updatedAt: Number(native["updated_at"]),
    };
  }

  /**
   * Create a new identity by invoking `create_identity` on the Soroban contract.
   * The transaction is built, simulated, prepared with auth entries, signed
   * with the provided secret key, submitted, and awaited.
   *
   * @returns The transaction hash of the confirmed submission.
   */
  async create(args: {
    pubkey: StellarPubKey;
    biometricCommitment: Uint8Array;
    metadataCid: string;
    recoveryOwners: StellarPubKey[];
    signerSecret: string;
  }): Promise<string> {
    const s = await stellar();
    const rpc = await this.parent.soroban();

    const contractId = this.parent.config.identityContractId;
    if (!contractId) throw new Error("identityContractId is not configured");

    const kp = s.Keypair.fromSecret(args.signerSecret);
    const sourcePubKey = kp.publicKey();
    const contract = new s.Contract(contractId);

    // Build ScVal arguments matching the contract's create_identity signature:
    //   fn create_identity(env, caller: Address, pubkey: BytesN<32>,
    //                      biometric_commit: BytesN<32>, metadata_cid: String,
    //                      recovery_owners: Vec<BytesN<32>>) -> bool
    const caller = s.Address.fromString(sourcePubKey).toScVal();
    const pkScVal = s.nativeToScVal(args.pubkey, { type: "bytes" });
    const bioScVal = s.nativeToScVal(args.biometricCommitment, { type: "bytes" });
    const cidScVal = s.nativeToScVal(args.metadataCid);

    // Vec<BytesN<32>> — convert each owner key to its own bytes ScVal
    const ownersScVal = s.nativeToScVal(
      args.recoveryOwners.map((o) => s.nativeToScVal(o, { type: "bytes" })),
    );

    const op = contract.call("create_identity", caller, pkScVal, bioScVal, cidScVal, ownersScVal);

    // Get the source account for the transaction
    const account = await rpc.getAccount(sourcePubKey);

    const tx = new s.TransactionBuilder(account, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // Simulate to obtain footprint and auth entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    // Prepare the transaction — merges the simulation result (footprint + auth)
    const preparedTx = await rpc.prepareTransaction(tx, simResult);

    // Sign with the submitter's keypair
    preparedTx.sign(kp);

    // Submit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendResult: any = await rpc.sendTransaction(preparedTx);

    if (sendResult.status !== "PENDING") {
      throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult)}`);
    }

    // Wait for confirmation
    await pollTransaction(rpc, sendResult.hash);

    return sendResult.hash;
  }
}

// ---------------------------------------------------------------------------
// WrappedBadge sub-client
// ---------------------------------------------------------------------------
class WrappedBadgeSubClient {
  constructor(private parent: SSIStellar) {}

  /**
   * Fetch a wrapped badge record by calling the Soroban contract's
   * `get_wrapped_badge` function via transaction simulation (read-only).
   */
  async get(
    subjectPubkey: StellarPubKey,
    sourceChainId: number,
    sourceTxHash: Uint8Array,
  ): Promise<WrappedBadge | null> {
    const s = await stellar();
    const rpc = await this.parent.soroban();
    const contractId = this.parent.config.wrappedBadgeContractId;
    if (!contractId) throw new Error("wrappedBadgeContractId is not configured");

    const contract = new s.Contract(contractId);
    const pkScVal = s.nativeToScVal(subjectPubkey, { type: "bytes" });
    const chainIdScVal = s.nativeToScVal(sourceChainId, { type: "u32" });
    const txHashScVal = s.nativeToScVal(sourceTxHash, { type: "bytes" });
    const op = contract.call("get_wrapped_badge", pkScVal, chainIdScVal, txHashScVal);

    const nullAccount = new s.Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0",
    );

    const tx = new s.TransactionBuilder(nullAccount, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    if (!simResult.result || !simResult.result.retval) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const native: Record<string, any> = s.scValToNative(simResult.result.retval);

    if (!native) {
      return null;
    }

    return {
      subjectPubkey: native["subject_pubkey"] as StellarPubKey,
      sourceChainId: Number(native["source_chain_id"]),
      sourceTxHash: bytesToHex(native["source_tx_hash"] as Uint8Array),
      cid: native["cid"] as string,
      assetCode: native["asset_code"] as string,
      status: (native["status"] as string) === "Active" ? "active" : "burned",
    };
  }

  /**
   * Mint a wrapped badge on Stellar by invoking `wrap_badge` on the Soroban
   * contract. The relayer must provide its secret key to sign the transaction.
   *
   * The transaction is built, simulated to obtain footprints & auth entries,
   * prepared, signed, submitted, and awaited.
   *
   * @returns The transaction hash on confirmation.
   */
  async wrap(args: {
    /** The subject's Stellar public key (32 raw bytes). */
    subjectPubkey: StellarPubKey;
    /** Source chain ID (e.g. 80002 for Polygon Amoy). */
    sourceChainId: number;
    /** Transaction hash of the BadgeLocked event on the source chain. */
    sourceTxHash: Uint8Array;
    /** IPFS CID of the encrypted credential. */
    cid: string;
    /** Schema hash (32 bytes) of the credential. */
    schemaHash: Uint8Array;
    /** Secret key of the relayer account (G… / S…). */
    relayerSecret: string;
  }): Promise<string> {
    const s = await stellar();
    const rpc = await this.parent.soroban();
    const contractId = this.parent.config.wrappedBadgeContractId;
    if (!contractId) throw new Error("wrappedBadgeContractId is not configured");

    const kp = s.Keypair.fromSecret(args.relayerSecret);
    const sourcePubKey = kp.publicKey();
    const contract = new s.Contract(contractId);

    // Build ScVal arguments matching the contract's wrap_badge signature:
    //   fn wrap_badge(env, relayer: Address, subject_pubkey: BytesN<32>,
    //                 source_chain_id: u32, source_tx_hash: BytesN<32>,
    //                 cid: String, schema_hash: BytesN<32>) -> bool
    const relayerAddr = s.Address.fromString(sourcePubKey).toScVal();
    const subjectScVal = s.nativeToScVal(args.subjectPubkey, { type: "bytes" });
    const chainIdScVal = s.nativeToScVal(args.sourceChainId, { type: "u32" });
    const txHashScVal = s.nativeToScVal(args.sourceTxHash, { type: "bytes" });
    const cidScVal = s.nativeToScVal(args.cid);
    const schemaScVal = s.nativeToScVal(args.schemaHash, { type: "bytes" });

    const op = contract.call(
      "wrap_badge",
      relayerAddr,
      subjectScVal,
      chainIdScVal,
      txHashScVal,
      cidScVal,
      schemaScVal,
    );

    // Get the source account for the transaction
    const account = await rpc.getAccount(sourcePubKey);

    const tx = new s.TransactionBuilder(account, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // Simulate to obtain footprint and auth entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    // Prepare the transaction — merges the simulation result (footprint + auth)
    const preparedTx = await rpc.prepareTransaction(tx, simResult);

    // Sign with the relayer's keypair
    preparedTx.sign(kp);

    // Submit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendResult: any = await rpc.sendTransaction(preparedTx);

    if (sendResult.status !== "PENDING") {
      throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult)}`);
    }

    // Wait for confirmation
    await pollTransaction(rpc, sendResult.hash);

    return sendResult.hash;
  }
}

// ---------------------------------------------------------------------------
// Credentials sub-client
// ---------------------------------------------------------------------------
class CredentialsSubClient {
  constructor(private parent: SSIStellar) {}

  /**
   * List credential schema hashes for a subject by simulating the contract's
   * `list_credentials` function, then fetching each full credential record.
   */
  async list(subject: StellarPubKey): Promise<Credential[]> {
    const s = await stellar();
    const rpc = await this.parent.soroban();
    const contractId = this.parent.config.identityContractId;

    if (!contractId) return [];

    const contract = new s.Contract(contractId);
    const pkScVal = s.nativeToScVal(subject, { type: "bytes" });
    const op = contract.call("list_credentials", pkScVal);

    const nullAccount = new s.Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0",
    );

    const tx = new s.TransactionBuilder(nullAccount, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    if (!simResult.result || !simResult.result.retval) {
      return [];
    }

    // list_credentials returns Vec<BytesN<32>> → Uint8Array[]
    const schemaHashes: Uint8Array[] = s.scValToNative(simResult.result.retval) as Uint8Array[];

    if (!Array.isArray(schemaHashes) || schemaHashes.length === 0) {
      return [];
    }

    // Fetch each credential record, reusing the SDK module & rpc connection
    const credentials: Credential[] = [];
    for (const shRaw of schemaHashes) {
      const cred = await this.getCredential(s, rpc, contractId, subject, shRaw);
      if (cred) credentials.push(cred);
    }

    return credentials;
  }

  /** Simulate a `get_credential` call and map the result to a Credential. */
  private async getCredential(
    s: any,
    rpc: any,
    contractId: string,
    subject: StellarPubKey,
    schemaHashRaw: Uint8Array,
  ): Promise<Credential | null> {
    if (!contractId) return null;

    const contract = new s.Contract(contractId);
    const pkScVal = s.nativeToScVal(subject, { type: "bytes" });
    const shScVal = s.nativeToScVal(schemaHashRaw, { type: "bytes" });
    const op = contract.call("get_credential", pkScVal, shScVal);

    const nullAccount = new s.Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0",
    );

    const tx = new s.TransactionBuilder(nullAccount, {
      fee: s.BASE_FEE,
      networkPassphrase: this.parent.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simResult: any = await rpc.simulateTransaction(tx);

    if (!simResult.result || !simResult.result.retval) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const native: Record<string, any> = s.scValToNative(simResult.result.retval);
    if (!native) return null;

    // The contract stores `issuer` as Address (a strkey string), but our
    // Credential type uses StellarPubKey (Uint8Array). Store what the
    // contract returns; the caller can convert via strKeyToPubKey if needed.
    return {
      issuer: native["issuer"] as StellarPubKey,
      subject: native["subject"] as StellarPubKey,
      schemaHash: bytesToHex(schemaHashRaw),
      cid: native["cid"] as string,
      validUntil: Number(native["valid_until"]),
      revoked: Boolean(native["revoked"]),
    };
  }
}
