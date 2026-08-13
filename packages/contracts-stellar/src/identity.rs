//! # IdentityRegistry
//!
//! The on-chain source of truth for every user identity.
//!
//! Each identity stores:
//!   * the user's Stellar `pubkey` (== their wallet address, stored as raw bytes)
//!   * a `biometric_commitment` — the hash of a WebAuthn-stored biometric
//!   * an IPFS CID pointing to an *encrypted* profile blob
//!   * a list of recovery-owner addresses (M-of-N social recovery)
//!
//! NOTE: Soroban `require_auth()` is only available on `Address`, not on
//! `BytesN<32>`. The public-key bytes are stored separately; callers pass
//! both their `Address` (for authentication) and the raw `BytesN<32>`
//! (as the storage key / identity pubkey field).

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String, Vec};

use crate::storage::{emit_event, require_pubkey_ownership, touch_identity, DataKey, IDENTITY_TTL};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Identity {
    pub pubkey: BytesN<32>,
    pub biometric_commitment: BytesN<32>,
    pub metadata_cid: String,
    pub recovery_owners: Vec<BytesN<32>>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct IdentityRegistry;

#[contractimpl]
impl IdentityRegistry {
    /// One-time initialisation that records the admin (deployer).
    ///
    /// # Panics
    /// * If the contract has already been initialised.
    ///
    /// # Arguments
    /// * `admin` — the privileged address allowed to authorise issuer
    ///   allow-listing and other registrar-gated operations.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Create a new identity.
    ///
    /// * `caller`            — the invoker's `Address`; must authorise the call.
    /// * `pubkey`            — caller's wallet public key (raw 32 bytes, stored).
    /// * `biometric_commit`  — Poseidon-style hash of biometric template.
    /// * `metadata_cid`      — IPFS CID of the encrypted profile blob.
    /// * `recovery_owners`   — list of guardian public keys (M-of-N).
    /// * `ownership_signature`— Ed25519 proof that `caller` controls `pubkey`
    ///   (see [`crate::storage::ownership_message`]); prevents squatting.
    ///
    /// # Returns
    /// `true` once the identity has been written to persistent storage and
    /// its TTL extended.
    ///
    /// # Panics
    /// * If an identity already exists for `pubkey`.
    /// * If `recovery_owners` is empty (M-of-N recovery needs ≥1 guardian).
    ///
    /// # Events
    /// Emits `identity_created(pubkey, biometric_commitment)` so the bridge
    /// relayer can index new wallets.
    pub fn create_identity(
        env: Env,
        caller: Address,
        pubkey: BytesN<32>,
        biometric_commit: BytesN<32>,
        metadata_cid: String,
        recovery_owners: Vec<BytesN<32>>,
        ownership_signature: BytesN<64>,
    ) -> bool {
        // Require the invoker to authenticate AND prove they control `pubkey`
        // via an Ed25519 proof-of-possession signature. `BytesN<32>` has no
        // `require_auth`; the Address authenticates and the signature binds it
        // to the raw public key used as the storage key.
        require_pubkey_ownership(&env, &caller, &pubkey, &ownership_signature);

        if env
            .storage()
            .persistent()
            .has(&DataKey::Identity(pubkey.clone()))
        {
            panic!("identity already exists");
        }
        if recovery_owners.is_empty() {
            panic!("at least one recovery owner required");
        }

        let now = env.ledger().timestamp();
        let id = Identity {
            pubkey: pubkey.clone(),
            biometric_commitment: biometric_commit,
            metadata_cid,
            recovery_owners,
            created_at: now,
            updated_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Identity(pubkey.clone()), &id);
        env.storage().persistent().extend_ttl(
            &DataKey::Identity(pubkey.clone()),
            IDENTITY_TTL,
            IDENTITY_TTL,
        );

        emit_event(
            &env,
            ("identity_created",),
            (pubkey.clone(), id.biometric_commitment.clone()),
        );
        true
    }

    /// Update the encrypted metadata pointer (e.g. user updated their avatar).
    ///
    /// # Arguments
    /// * `caller`  — the invoking wallet `Address`; must authorise.
    /// * `pubkey`  — the identity to update (matches `caller`).
    /// * `new_cid` — replacement IPFS CID.
    /// * `ownership_signature` — proof that `caller` controls `pubkey`.
    ///
    /// # Panics
    /// * If no identity is stored for `pubkey`.
    pub fn update_metadata(
        env: Env,
        caller: Address,
        pubkey: BytesN<32>,
        new_cid: String,
        ownership_signature: BytesN<64>,
    ) -> bool {
        require_pubkey_ownership(&env, &caller, &pubkey, &ownership_signature);
        let mut id: Identity = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(pubkey.clone()))
            .expect("identity not found");

        id.metadata_cid = new_cid;
        id.updated_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Identity(pubkey.clone()), &id);
        true
    }

    /// Read an identity record.
    ///
    /// # Returns
    /// `Some(Identity)` if one is stored, otherwise `None`. Read-only and
    /// does NOT extend TTL — callers that hold a long-lived reference
    /// should invoke `crate::storage::touch_identity` themselves.
    pub fn get_identity(env: Env, pubkey: BytesN<32>) -> Option<Identity> {
        env.storage().persistent().get(&DataKey::Identity(pubkey))
    }

    /// Rotate the biometric commitment (e.g. user re-enrolled their fingerprint).
    ///
    /// # Arguments
    /// * `caller`     — the invoking wallet `Address`; must authorise.
    /// * `pubkey`     — the identity to rotate (matches `caller`).
    /// * `new_commit` — replacement 32-byte commitment.
    /// * `ownership_signature` — proof that `caller` controls `pubkey`.
    ///
    /// # Effects
    /// Also calls [`crate::storage::touch_identity`] so the persistent
    /// entries for the subject don't expire in the middle of recovery flow.
    ///
    /// # Panics
    /// * If no identity is stored for `pubkey`.
    pub fn rotate_biometric(
        env: Env,
        caller: Address,
        pubkey: BytesN<32>,
        new_commit: BytesN<32>,
        ownership_signature: BytesN<64>,
    ) -> bool {
        require_pubkey_ownership(&env, &caller, &pubkey, &ownership_signature);
        let mut id: Identity = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(pubkey.clone()))
            .expect("identity not found");
        id.biometric_commitment = new_commit;
        id.updated_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Identity(pubkey.clone()), &id);
        // Refresh TTL on both the identity record and its credentials index so
        // the user doesn't lose access mid-recovery.
        touch_identity(&env, &pubkey);
        true
    }
}
