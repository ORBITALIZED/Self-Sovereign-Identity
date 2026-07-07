//! # Credentials Contract
//!
//! Issued by issuers (universities, employers, hospitals) and held by subjects.
//! Each credential references an IPFS CID for the encrypted document +
//! a `schema_hash` describing its type.
//!
//! NOTE: `Address` cannot be converted into `BytesN<32>` via `try_into` in
//! soroban-sdk v20 — they are distinct types.  The `Credential` struct now
//! stores `issuer` as `Address` directly.

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

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
    pub fn authorize_issuer(env: Env, issuer: Address) {
        let admin = crate::storage::require_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Admin, &issuer); // reuse Admin key — single registry
    }

    /// Issue a credential (caller must be an authorized issuer).
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

        emit_event(
            &env,
            ("credential_issued",),
            (issuer, subject, schema_hash),
        );
        true
    }

    /// Revoke a previously issued credential (caller must be the issuer).
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

        emit_event(&env, ("credential_revoked",), (issuer, subject, schema_hash));
        true
    }

    /// Read a single credential.
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
    pub fn list_credentials(env: Env, subject: BytesN<32>) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::CredIndex(subject))
            .unwrap_or(Vec::new(&env))
    }
}
