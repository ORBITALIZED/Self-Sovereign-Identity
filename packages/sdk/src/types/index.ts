/**
 * Shared types used across the Stellar / EVM / ZK clients.
 */

/** A Stellar public key — 32 raw bytes (G… string encoded by callers). */
export type StellarPubKey = Uint8Array;

/** An EVM address — lowercase 0x-prefixed hex. */
export type EvmAddress = `0x${string}`;

/** Poseidon / SHA / Blake2 — any 32-byte hash as Uint8Array. */
export type Commitment = Uint8Array;

/** IPFS CID — string, v0 or v1. */
export type IpfsCid = string;

/** Generic 32-byte identifier used in both chains. */
export type Hash32 = `0x${string}`;

/** Full Identity record (Soroban-shaped). */
export interface Identity {
  pubkey: StellarPubKey;
  biometricCommitment: Commitment;
  metadataCid: IpfsCid;
  recoveryOwners: StellarPubKey[];
  createdAt: number;
  updatedAt: number;
}

export interface Credential {
  issuer: StellarPubKey;
  subject: StellarPubKey;
  schemaHash: Hash32;
  cid: IpfsCid;
  validUntil: number;
  revoked: boolean;
}

export interface WrappedBadge {
  subjectPubkey: StellarPubKey;
  sourceChainId: number;
  sourceTxHash: Hash32;
  cid: IpfsCid;
  assetCode: string;
  status: "active" | "burned";
}

export interface ChainConfig {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export interface EvmConfig {
  rpcUrl: string;
  chainId: number;
  contracts: {
    registry: EvmAddress;
    sbt: EvmAddress;
    bridge: EvmAddress;
  };
}
