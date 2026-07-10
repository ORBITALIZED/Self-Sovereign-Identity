# 🏛️ Architecture

End-to-end overview of every subsystem in the SSI platform.

---

## 1. Goals

| Goal                                                   | How it is achieved                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Identity owned by the user, not a state or corporation | Soroban registry keyed by the user's wallet; private keys never leave the user's wallet                                        |
| Selective disclosure                                   | Circom zero-knowledge circuits prove properties (age, citizenship, credential ownership) without revealing the underlying data |
| Works across borders                                   | Bridge relayer wraps EVM-issued Soulbound badges as Stellar-native wrapped assets                                              |
| Recoverable                                            | Social-recovery contract with M-of-N trusted guardians                                                                         |
| Auditable but private                                  | Encrypted attestations pinned to IPFS, content-addressed by CIDs referenced from on-chain credentials                          |
| Resistant to fraud                                     | Python ML service flags sybil / credential-stuffing patterns in real time                                                      |

---

## 2. Logical Components

```
┌────────────────────────────────────────────────────────────────────┐
│                          User Layer                                │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  React App   │ ←→ │   User Wallet    │ ←→ │ Biometric sensor │  │
│  │  (Vite SPA)  │    │ (Freighter /     │    │ (WebAuthn)       │  │
│  │              │    │  MetaMask)       │    │                  │  │
│  └──────┬───────┘    └────────┬─────────┘    └──────────────────┘  │
└─────────┼─────────────────────┼───────────────────────────────────┘
          │ HTTPS               │ signed tx
          ▼                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Service Layer                             │
│                                                                     │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────────┐    │
│  │ API        │  │ Bridge      │  │ IPFS       │  │ AI Fraud    │    │
│  │ Gateway    │  │ Relayer     │  │ Service    │  │ Detector    │    │
│  │ (Fastify)  │  │ (Horizon +  │  │ (Helia +   │  │ (FastAPI +  │    │
│  │            │  │  EVM WS)    │  │  AES-GCM)  │  │  sklearn)   │    │
│  └─────┬──────┘  └──────┬──────┘  └──────┬─────┘  └──────┬──────┘    │
└────────┼────────────────┼────────────────┼──────────────┼───────────┘
         │                │                │              │
         ▼                ▼                ▼              ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Chain Layer                               │
│                                                                     │
│  ┌─────────────────┐    wrapped    ┌──────────────────────────┐    │
│  │ Stellar Soroban │ ←─tokens────  │  EVM chains              │    │
│  │ contracts       │               │  (Polygon/Ethereum/etc.) │    │
│  │  • IdentityReg  │ ──wrapped──→  │   • IdentitySBT (ERC721) │    │
│  │  • WrappedBadge │    tokens     │   • IdentityRegistry     │    │
│  │  • SocialRecov  │               │   • WrappedBadge         │    │
│  │  • Credentials  │               │                          │    │
│  └─────────────────┘               └──────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Identity Creation

```
1. User  →  Frontend  : "Create my identity"
2. Frontend → Wallet : signMessage(pubkey, biometric_commitment, nil)
3. Wallet  → Soroban : create_identity(pubkey, commitment, recovery_owners[])
4. Soroban → IPFS Svc : pin encrypted metadata (off-chain profile blob)
5. Soroban → AI Svc   : score heuristics → returns fraud_score ∈ [0, 1]
6. Soroban persists    : Identity { pubkey, commitment, badges: [], recovery: [...] }
7. Soroban → Frontend : tx hash + Identity NFT id
```

### 3.2 Credential Issuance (Educational / Medical / Employment)

```
1. Issuer (e.g. University) → Soroban : issue_credential(issuer_pubkey, subject_pubkey, cid, valid_until)
2. Soroban emits  CredentialIssued(subject, cid, schema_hash)
3. Anyone → Soroban : verify_credential(subject, schema, nulllifier)
   → returns ZK proof that subject holds a valid credential from a trusted issuer,
     *without revealing which credential*.
```

### 3.3 Cross-Border Verification via Wrapped Badges

```
1. Issuer (EVM chain) → Identity SBT minted via ERC-721 (non-transferable = SBT)
2. Bridge Relayer observes the EVM `Transfer` event (incl. zero address mint)
3. Relayer → AI Fraud : score the issuer + holder pair
4. Relayer → ZK Prover : prepare a cross-chain proof-of-burn from the EVM side
5. Relayer → Soroban (WrappedBadge) : mint_wrapped(holder_pubkey, cid, schema_hash)
6. Soroban wraps the badge as a Stellar-native asset:
     - Asset code:  WID-<schema-hash-prefix>
     - Issued by:   WrappedBadge contract
     - Auth required: holder_pubkey
7. Frontend Bridge Monitor (Horizon SSE) shows the real-time emission event.
```

---

## 4. Smart-Contract Surfaces

### 4.1 Stellar / Soroban (`packages/contracts-stellar`)

```rust
// IdentityRegistry
env.invoke_contract("create_identity", (pubkey, commitment, recovery_owners, dob_commitment))
env.invoke_contract("update_metadata",  (pubkey, cid))
env.invoke_contract("recover_identity", (lost_pubkey, new_pubkey, guardian_proofs))

// Credentials
env.invoke_contract("issue_credential",   (issuer, subject, schema_hash, cid, valid_until))
env.invoke_contract("reveal_credential",  (subject, schema_hash, viewer, ephemeral_key))
env.invoke_contract("revoke_credential",  (issuer, subject, schema_hash))

// WrappedBadge
env.invoke_contract("wrap_badge",         (subject_pubkey, source_chain_id, source_tx, cid))
env.invoke_contract("unwrap_badge",       (subject_pubkey, dest_chain_id))

// SocialRecovery
env.invoke_contract("set_guardians",      (subject, guardians, threshold))
env.invoke_contract("guardian_attest",    (subject, new_pubkey, signature))
```

Each call emits a Soroban event consumed by the bridge relayer (via Horizon SSE).

### 4.2 EVM / Solidity (`packages/contracts-evm`)

```solidity
// IdentitySBT  — ERC-721 with `_beforeTokenTransfer` overridden to reject transfers
contract IdentitySBT is
  ERC721SBT // openzeppelin SBT base
{
  function issueCredential(address holder, bytes32 schema, string calldata cid) external onlyIssuer;
  function revokeCredential(uint256 tokenId) external onlyIssuer;
}

// IdentityRegistry
function registerIdentity(bytes32 commitment, address[] calldata guardians) external;
function attest(address subject, bytes32 schemaHash) external onlyIssuer;

// WrappedBadge (Bridge)
function lockAndNotify(bytes calldata stellarPubkey, uint256 badgeId) external; // burns SBT, emits LockEvent
```

---

## 5. Privacy Model

| Data               | Where it lives                                                       | Who reads it                                     |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------ |
| Wallet private key | User device                                                          | Only the user                                    |
| Biometric template | Inside WebAuthn enclave, then `biometric_commitment` (hash) on-chain | Nobody — only proves the user is consistent      |
| Encrypted profile  | IPFS (AES-GCM, key derived from wallet signature)                    | User + authorized viewers                        |
| Credential         | IPFS (CID), reference on chain                                       | Issuer, holder, anyone with a valid presentation |
| Identity NFT       | Public (Soroban)                                                     | Public — but only references commitments/CIDs    |
| Wrapped badge      | Public (Soroban asset)                                               | Public                                           |
| ZK proof           | Public (Soroban `verify_proof`)                                      | Anyone — proves a property, reveals nothing      |

---

## 6. Failure Modes

| Failure                | Mitigation                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Bridge relayer crashes | Idempotent relayer; restart from last consumed block; Postgres-backed state        |
| Soroban RPC outage     | Frontend caches last-known identity snapshot in localStorage (encrypted)           |
| IPFS pinning fails     | Retry queue (BullMQ + Redis); fall back to Filecoin / Arweave via pluggable pinner |
| AI fraud service down  | Soft-fail open-but-flag; manual review queue for new identities                    |
| Lost wallet            | Social recovery (M-of-N guardians)                                                 |
| Biometric spoof        | WebAuthn enclave + liveness challenge + ML fraud scoring                           |

---

## 7. Deployment Topology

```
┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
│   Vercel     │   │  Fly.io /      │   │  Railway /       │
│ (Frontend)   │   │  Render        │   │  Render          │
│              │   │ (API Gateway   │   │ (Bridge Relayer, │
│              │   │  + IPFS Svc)   │   │  IPFS, AI Fraud) │
└──────────────┘   └────────────────┘   └──────────────────┘

┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
│  Stellar     │   │  EVM (Polygon  │   │  Postgres +      │
│  Testnet →   │   │  Mumbai/Amoy)  │   │  Redis           │
│  Mainnet     │   │                │   │  (Neon / Supabase│
│              │   │                │   │   / Railway)     │
└──────────────┘   └────────────────┘   └──────────────────┘
```
