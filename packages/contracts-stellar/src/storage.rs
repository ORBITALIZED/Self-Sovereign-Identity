//! Helper types & functions for working with Soroban persistent storage.
//! Centralises TTL conventions so we don't sprinkle magic numbers everywhere.

use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, IntoVal, Val};

/// Number of ledgers to keep an identity record alive (≈ 1 day at 5s/ledger).
pub const IDENTITY_TTL: u32 = 17_280;

/// Number of ledgers to keep a credential alive (≈ 6 days at 5s/ledger).
pub const CREDENTIAL_TTL: u32 = 103_680;

/// Domain separator for proof-of-ownership signatures.
pub const OWNERSHIP_DOMAIN: &[u8] = b"ssi-ownership-v1";

/// Stellar strkeys are always 56 characters (`G…` accounts, `C…` contracts).
pub const STRKEY_LEN: usize = 56;

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
    /// Stellar Asset Contract ID for the wrapped badge asset.
    StellarAsset,
    /// Admin address (the deployer) — used for permissioned operations.
    Admin,
    /// Issuer allowlist entry.
    IssuerAllowlist(Address),
    /// Relayer allowlist entry (authorised bridge relayers).
    RelayerAllowlist(Address),
}

/// Extend the TTL of every stored entry related to a user.
pub fn touch_identity(env: &Env, owner: &BytesN<32>) {
    env.storage().persistent().extend_ttl(
        &DataKey::Identity(owner.clone()),
        IDENTITY_TTL,
        IDENTITY_TTL,
    );
    env.storage().persistent().extend_ttl(
        &DataKey::CredIndex(owner.clone()),
        IDENTITY_TTL,
        IDENTITY_TTL,
    );
}

/// Helper that lets modules emit a structured event.
///
/// `topics` must be a Soroban-compatible tuple (e.g. `("my_topic",)` or
/// `("topic_a", "topic_b")`).  Passing a Rust slice (`&[&str]`) is **not**
/// accepted by `env.events().publish` — Soroban requires a type that
/// implements `IntoVal<Env, Val>`, which tuples do but slices do not.
pub fn emit_event<T, V>(env: &Env, topics: T, value: V)
where
    T: IntoVal<Env, Val> + soroban_sdk::events::Topics,
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

/// Build the canonical message a caller signs to prove they control `pubkey`.
///
/// The caller's strkey is bound into the message so a signature collected for
/// one address cannot be replayed by a different address (anti-squatting).
/// The resulting bytes are what the SDK / wallet must Ed25519-sign.
pub fn ownership_message(env: &Env, caller: &Address, pubkey: &BytesN<32>) -> Bytes {
    let mut msg = Bytes::from_slice(env, OWNERSHIP_DOMAIN);
    msg.extend_from_slice(b"|");

    // `Address::to_string()` always yields a 56-char strkey.
    let caller_str = caller.to_string();
    let mut strkey = [0u8; STRKEY_LEN];
    caller_str.copy_into_slice(&mut strkey);
    msg.extend_from_slice(&strkey);

    msg.extend_from_slice(b"|");
    msg.extend_from_array(&pubkey.to_array());
    msg
}

/// Require the caller to authenticate AND prove control of `pubkey` via an
/// Ed25519 signature over [`ownership_message`].
///
/// `caller.require_auth()` proves the caller controls their Stellar account,
/// and the signature proves they hold the private key for `pubkey`. Together
/// these prevent an authenticated caller from registering or mutating records
/// for a public key they do not own (identity squatting, metadata overwrite,
/// recovery reconfiguration, etc.).
pub fn require_pubkey_ownership(
    env: &Env,
    caller: &Address,
    pubkey: &BytesN<32>,
    signature: &BytesN<64>,
) {
    caller.require_auth();
    let msg = ownership_message(env, caller, pubkey);
    env.crypto().ed25519_verify(pubkey, &msg, signature);
}
