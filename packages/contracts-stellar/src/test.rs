//! On-chain integration tests.
//! Run with:  `cargo test --features testutils`
//!
//! NOTE: `cargo test` is currently disabled in `Cargo.toml` (`test = false`)
//! because of an upstream regression in stellar-xdr 20.0.x. The tests below
//! will compile and run once that fix ships, AND once `testutils` is enabled.
//! See `docs/upstream-issue-drafts/rs-stellar-xdr-arbitrary-regression.md`
//! for the upstream issue.

#![cfg(test)]

use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::credentials::{CredentialsIssuer, CredentialsIssuerClient};
use crate::identity::{Identity, IdentityRegistry, IdentityRegistryClient};

#[test]
fn create_and_get_identity() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);

    client.initialize(&admin);

    // Caller Address is used for require_auth; pubkey is the raw 32-byte key.
    let caller = admin.clone();
    let pk = BytesN::from_array(&env, &[1u8; 32]);
    let commit = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmScaffoldPlaceholderCid0000000000000000000000");
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[3u8; 32])]);

    let ok = client.create_identity(&caller, &pk, &commit, &cid, &guardians);
    assert!(ok);

    let stored: Option<Identity> = client.get_identity(&pk);
    assert!(stored.is_some());
    let id = stored.unwrap();
    assert_eq!(id.biometric_commitment, commit);
}

/// Revocation should flip `revoked` to true without touching the index.
#[test]
fn revoke_credential_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Bootstrap a credentials issuer.
    let issuer_address = Address::from_string(&String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let contract_id = env.register_contract(None, CredentialsIssuer);
    let creds = CredentialsIssuerClient::new(&env, &contract_id);

    let subject = BytesN::from_array(&env, &[7u8; 32]);
    let schema_hash = BytesN::from_array(&env, &[8u8; 32]);
    let cid = String::from_str(&env, "QmCredentialContent00000000000000000000000000");

    // Issue
    assert!(creds.issue_credential(
        &issuer_address,
        &subject,
        &schema_hash,
        &cid,
        &9_999_999_999u64,
    ));

    // Sanity: revoked starts false.
    let stored = creds.get_credential(&subject, &schema_hash).unwrap();
    assert!(!stored.revoked);

    // Revoke (the issuer is the same caller).
    assert!(creds.revoke_credential(&issuer_address, &subject, &schema_hash));

    // After revoke: revoked == true, all other fields unchanged.
    let stored = creds.get_credential(&subject, &schema_hash).unwrap();
    assert!(stored.revoked);
    assert_eq!(stored.cid, cid);
}
