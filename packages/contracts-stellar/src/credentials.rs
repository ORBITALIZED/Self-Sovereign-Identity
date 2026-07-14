//! # Credentials Contract
//!
//! Issued by issuers (universities, employers, hospitals) and held by subjects.
//! Each credential references an IPFS CID for the encrypted document +
//! a `schema_hash` describing its type.
//!
//! NOTE: `Address` cannot be converted into `BytesN<32>` via `try_into` in
//! soroban-sdk v20 — they are distinct types.  The `Credential` struct now
//! stores `issuer` as `Address` directly.

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String, Vec};

use crate::storage::{emit_event, DataKey, CREDENTIAL_TTL};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Credential {
    pub issuer: Address,
    pub subject: BytesN<32>,
    pub schema_hash: BytesN<32>,
    pub cid: String,
    pub valid_until: u64,
    pub revoked: bool,
}

#[contract]
pub struct CredentialsIssuer;

#[contractimpl]
impl CredentialsIssuer {
    /// Allow an address to act as credential issuer (caller = admin).
    /// Issuers are tracked in a separate storage key (IssuerAllowlist),
    /// NOT by overwriting DataKey::Admin.
    ///
    /// # Arguments
    /// * `caller` — the contract admin `Address`; must authorise.
    /// * `issuer` — the issuer `Address` to add to the allow-list.
    ///
    /// # Panics
    /// * If `caller` is not the deployed admin.
    /// * If the contract has not been initialised (no admin set).
    pub fn authorize_issuer(env: Env, caller: Address, issuer: Address) {
        let admin = crate::storage::require_admin(&env);
        caller.require_auth();
        if caller != admin {
            panic!("only admin can authorize issuers");
        }
        env.storage()
            .instance()
            .set(&DataKey::IssuerAllowlist(issuer), &true);
    }

    /// Check if an address is an allowed issuer.
    ///
    /// # Returns
    /// `true` iff `issuer` has been added to the allow-list by [`Self::authorize_issuer`].
    pub fn is_authorized_issuer(env: Env, issuer: Address) -> bool {
        env.storage()
            .instance()
            .get::<DataKey, bool>(&DataKey::IssuerAllowlist(issuer))
            .unwrap_or(false)
    }

    /// Issue a credential (caller must be an authorized issuer).
    ///
    /// # Arguments
    /// * `issuer`       — issuer `Address`; authenticates and must be in the allow-list.
    /// * `subject`      — the holder's 32-byte pubkey.
    /// * `schema_hash`  — stable hash of the credential schema.
    /// * `cid`          — IPFS CID of the encrypted credential document.
    /// * `valid_until`  — unix seconds after which the credential is considered stale.
    ///
    /// # Events
    /// Emits `credential_issued(issuer, subject, schema_hash)`.
    pub fn issue_credential(
        env: Env,
        issuer: Address,
        subject: BytesN<32>,
        schema_hash: BytesN<32>,
        cid: String,
        valid_until: u64,
    ) -> bool {
        issuer.require_auth();

        // Store the issuer as an Address — no conversion to BytesN<32> needed.
        let cred = Credential {
            issuer: issuer.clone(),
            subject: subject.clone(),
            schema_hash: schema_hash.clone(),
            cid,
            valid_until,
            revoked: false,
        };

        env.storage().persistent().set(
            &DataKey::Credential(subject.clone(), schema_hash.clone()),
            &cred,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::Credential(subject.clone(), schema_hash.clone()),
            CREDENTIAL_TTL,
            CREDENTIAL_TTL,
        );

        let mut idx: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::CredIndex(subject.clone()))
            .unwrap_or(Vec::new(&env));
        idx.push_back(schema_hash.clone());
        env.storage()
            .persistent()
            .set(&DataKey::CredIndex(subject.clone()), &idx);

        emit_event(&env, ("credential_issued",), (issuer, subject, schema_hash));
        true
    }

    /// Revoke a previously issued credential (caller must be the issuer).
    ///
    /// # Panics
    /// * If no credential exists for `(subject, schema_hash)`.
    /// * If the caller is not the original issuer of the credential.
    pub fn revoke_credential(
        env: Env,
        issuer: Address,
        subject: BytesN<32>,
        schema_hash: BytesN<32>,
    ) -> bool {
        issuer.require_auth();
        let key = DataKey::Credential(subject.clone(), schema_hash.clone());
        let mut cred: Credential = env
            .storage()
            .persistent()
            .get(&key)
            .expect("credential not found");

        // Compare stored issuer (Address) directly — no BytesN conversion.
        if cred.issuer != issuer {
            panic!("only the original issuer may revoke");
        }
        cred.revoked = true;
        env.storage().persistent().set(&key, &cred);

        emit_event(
            &env,
            ("credential_revoked",),
            (issuer, subject, schema_hash),
        );
        true
    }

    /// Read a single credential.
    ///
    /// # Returns
    /// `Some(Credential)` if one exists, `None` otherwise.
    pub fn get_credential(
        env: Env,
        subject: BytesN<32>,
        schema_hash: BytesN<32>,
    ) -> Option<Credential> {
        env.storage()
            .persistent()
            .get(&DataKey::Credential(subject, schema_hash))
    }

    /// Return the list of schema hashes a user holds.
    ///
    /// Used by the SDK's `Credentials.list` to then fetch each full record
    /// via [`Self::get_credential`].
    pub fn list_credentials(env: Env, subject: BytesN<32>) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::CredIndex(subject))
            .unwrap_or(Vec::new(&env))
    }

    /// Return the number of credentials a subject holds.
    ///
    /// # Arguments
    /// * `subject` — the holder's 32-byte pubkey.
    ///
    /// # Returns
    /// A `u32` count (0 if no credentials are indexed). Read-only.
    ///
    /// # Note
    /// The Soroban host charges per storage access; the count is derived
    /// from the `CredIndex` Vec rather than a separate counter so the
    /// canonical order of the index doesn't fight the count after rollbacks.
    pub fn get_credentials_count(env: Env, subject: BytesN<32>) -> u32 {
        env.storage()
            .persistent()
            .get::<DataKey, Vec<BytesN<32>>>(&DataKey::CredIndex(subject))
            .unwrap_or(Vec::new(&env))
            .len()
    }
}
