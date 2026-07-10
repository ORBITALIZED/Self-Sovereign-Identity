# 📦 @ssi/contracts-stellar

Soroban (Rust) smart contracts for the Self-Sovereign Identity platform — the **primary on-chain identity registry** of the system.

| Module               | Purpose                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `identity.rs`        | The core **IdentityRegistry** — stores public keys, biometric commitments, recovery owners |
| `credentials.rs`     | Issue / reveal / revoke educational, employment and medical credentials with CIDs          |
| `wrapped_badge.rs`   | Wraps cross-chain Soulbound badges as Stellar-native wrapped assets                        |
| `social_recovery.rs` | M-of-N guardian-based recovery flow                                                        |
| `storage.rs`         | Typed storage helpers with TTL                                                             |
| `test.rs`            | On-chain integration tests for the whole contract                                          |

This contract suite is intended to be deployed to **Stellar Testnet (and eventually Mainnet)** via Soroban CLI / SDK.

## Build

```bash
make build          # produces target/wasm32-unknown-unknown/release/*.wasm
make test           # cargo test --features testutils
make deploy         # uses STELLAR_DEPLOYER_SECRET in env
```

## Schema

```rust
pub struct Identity {
    pub pubkey: BytesN<32>,
    pub biometric_commitment: BytesN<32>,
    pub metadata_cid: String,        // IPFS CID of encrypted profile
    pub recovery_owners: Vec<BytesN<32>>,
    pub created_at: u64,
    pub updated_at: u64,
}

pub struct Credential {
    pub issuer: BytesN<32>,
    pub subject: BytesN<32>,
    pub schema_hash: BytesN<32>,
    pub cid: String,                 // IPFS CID of credential document
    pub valid_until: u64,
    pub revoked: bool,
}
```

Events emitted:

- `IdentityCreated(pubkey, commitment)`
- `CredentialIssued(subject, schema_hash, cid)`
- `BadgeWrapped(subject, source_chain, source_tx)`
- `RecoveryInitiated(lost_pubkey, new_pubkey)`
