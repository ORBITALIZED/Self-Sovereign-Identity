//! Helper types & functions for working with Soroban persistent storage.
//! Centralises TTL conventions so we don't sprinkle magic numbers everywhere.

use soroban_sdk::{contracttype, Address, BytesN, Env, IntoVal, Val};

/// Number of ledgers to keep an identity record alive (≈ 5 days at 5s/ledger).
pub const IDENTITY_TTL: u32 = 17_280;

/// Number of ledgers to keep a credential alive (≈ 30 days).
pub const CREDENTIAL_TTL: u32 = 103_680;

/// Common storage keys.
#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// `Identity` record keyed by user pubkey.
    Identity(BytesN<32>),
    /// Index: which credential schemas does a user hold?
    CredIndex(BytesN<32>),
    /// A specific `(subject, schema_hash)` credential.
    Credential(BytesN<32>, BytesN<32>),
    /// Recovery configuration: `(subject, guardians, threshold)`.
    Recovery(BytesN<32>),
    /// Wrapped badge: `(subject, source_chain_id, source_tx_hash)`.
    WrappedBadge(BytesN<32>, u32, BytesN<32>),
    /// Admin address (the deployer) — used for permissioned operations.
    Admin,
}

/// Extend the TTL of every stored entry related to a user.
pub fn touch_identity(env: &Env, owner: &BytesN<32>) {
    env.storage()
        .persistent()
        .extend_ttl(DataKey::Identity(owner.clone()), IDENTITY_TTL, IDENTITY_TTL);
    env.storage()
        .persistent()
        .extend_ttl(DataKey::CredIndex(owner.clone()), IDENTITY_TTL, IDENTITY_TTL);
}

/// Helper that lets modules emit a structured event.
///
/// `topics` must be a Soroban-compatible tuple (e.g. `("my_topic",)` or
/// `("topic_a", "topic_b")`).  Passing a Rust slice (`&[&str]`) is **not**
/// accepted by `env.events().publish` — Soroban requires a type that
/// implements `IntoVal<Env, Val>`, which tuples do but slices do not.
pub fn emit_event<T, V>(env: &Env, topics: T, value: V)
where
    T: IntoVal<Env, Val>,
    V: IntoVal<Env, Val>,
{
    env.events().publish(topics, value);
}

/// Returns the admin (deployer) address, panicking if missing.
pub fn require_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Admin)
        .expect("admin not initialised")
}
