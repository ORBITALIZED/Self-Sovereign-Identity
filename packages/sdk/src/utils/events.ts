/**
 * Decoded event payloads emitted by Soroban contracts (consumed by the relayer).
 */

import type { StellarPubKey, IpfsCid, Hash32 } from "../types/index.js";

export interface IdentityCreatedEvent {
  topic: "identity_created";
  pubkey: StellarPubKey;
  biometricCommitment: Uint8Array;
}

export interface CredentialIssuedEvent {
  topic: "credential_issued";
  issuer: StellarPubKey;
  subject: StellarPubKey;
  schemaHash: Hash32;
}

export interface BadgeWrappedEvent {
  topic: "badge_wrapped";
  pubkey: StellarPubKey;
  sourceChainId: number;
  sourceTxHash: Hash32;
  assetCode: string;
  cid: IpfsCid;
}

export type AnyEvent = IdentityCreatedEvent | CredentialIssuedEvent | BadgeWrappedEvent;
