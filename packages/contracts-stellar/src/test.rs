//! On-chain integration tests.
//! Run with:  `cargo test --features testutils`

#![cfg(test)]

use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::credentials::{CredentialsIssuer, CredentialsIssuerClient};
use crate::identity::{Identity, IdentityRegistry, IdentityRegistryClient};
use crate::social_recovery::{SocialRecoveryContract, SocialRecoveryContractClient};
use crate::storage::DataKey;
use crate::wrapped_badge::{
    WrappedBadge, WrappedBadgeContract, WrappedBadgeContractClient, WrappedBadgeStatus,
};

/// A deterministic Ed25519 signing key (fixed seed) shared across tests so the
/// "pubkey" derived from it stays stable.
fn signing_key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}

/// Sign the canonical ownership message for `(caller, pubkey)`.
///
/// `require_pubkey_ownership` verifies this exact message via
/// `env.crypto().ed25519_verify`, so the test must sign the *same* bytes the
/// contract reconstructs.
fn sign_ownership(env: &Env, caller: &Address, pubkey: &BytesN<32>, sk: &SigningKey) -> BytesN<64> {
    let msg = crate::storage::ownership_message(env, caller, pubkey);
    // Message is fixed-size: domain(16) + '|' + strkey(56) + '|' + pubkey(32).
    let mut buf = [0u8; 106];
    msg.copy_into_slice(&mut buf);
    let sig = sk.sign(&buf);
    BytesN::from_array(env, &sig.to_bytes())
}

/// A 32-byte array derived from `sk`'s verifying key, wrapped as a `BytesN`.
fn pubkey_of(env: &Env, sk: &SigningKey) -> BytesN<32> {
    BytesN::from_array(env, &sk.verifying_key().to_bytes())
}

// ---------------------------------------------------------------------------
// IdentityRegistry
// ---------------------------------------------------------------------------

#[test]
fn create_and_get_identity() {
    let env = Env::default();
    env.mock_all_auths();

    let sk = signing_key();
    let pubkey = pubkey_of(&env, &sk);
    let caller = Address::generate(&env);
    let commit = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmScaffoldPlaceholderCid0000000000000000000000");
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[3u8; 32])]);

    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);
    client.initialize(&Address::generate(&env));

    let sig = sign_ownership(&env, &caller, &pubkey, &sk);
    let ok = client.create_identity(&caller, &pubkey, &commit, &cid, &guardians, &sig);
    assert!(ok);

    let stored: Option<Identity> = client.get_identity(&pubkey);
    assert!(stored.is_some());
    let id = stored.unwrap();
    assert_eq!(id.biometric_commitment, commit);
}

/// Initialize must reject a second call — admin is set exactly once.
#[test]
#[should_panic(expected = "already initialized")]
fn initialize_panics_on_second_call() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);
    client.initialize(&admin);
    client.initialize(&admin);
}

/// Empty guardian list is rejected so users cannot silently lose all recovery paths.
#[test]
#[should_panic(expected = "at least one recovery owner required")]
fn create_identity_panics_on_no_guardians() {
    let env = Env::default();
    env.mock_all_auths();
    let sk = signing_key();
    let pubkey = pubkey_of(&env, &sk);
    let caller = Address::generate(&env);
    let commit = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmScaffoldPlaceholderCid0000000000000000000000");
    let empty_guards: Vec<BytesN<32>> = Vec::new(&env);

    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);
    client.initialize(&Address::generate(&env));

    let sig = sign_ownership(&env, &caller, &pubkey, &sk);
    client.create_identity(&caller, &pubkey, &commit, &cid, &empty_guards, &sig);
}

/// C3: an authenticated caller who cannot prove control of `pubkey` is rejected.
#[test]
#[should_panic]
fn create_identity_rejects_wrong_ownership_signature() {
    let env = Env::default();
    env.mock_all_auths();
    let sk = signing_key();
    let pubkey = pubkey_of(&env, &sk);
    let caller = Address::generate(&env);
    let commit = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmScaffoldPlaceholderCid0000000000000000000000");
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[3u8; 32])]);

    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);
    client.initialize(&Address::generate(&env));

    let bogus = BytesN::from_array(&env, &[0u8; 64]);
    client.create_identity(&caller, &pubkey, &commit, &cid, &guardians, &bogus);
}

// ---------------------------------------------------------------------------
// CredentialsIssuer — allow-list enforcement (C1)
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "issuer is not authorized")]
fn issue_credential_requires_authorized_issuer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    let contract_id = env.register_contract(None, CredentialsIssuer);
    let creds = CredentialsIssuerClient::new(&env, &contract_id);
    creds.initialize_credentials(&admin);

    let subject = BytesN::from_array(&env, &[7u8; 32]);
    let schema_hash = BytesN::from_array(&env, &[8u8; 32]);
    let cid = String::from_str(&env, "QmCredentialContent00000000000000000000000000");

    // `issuer` was never added to the allow-list.
    creds.issue_credential(&issuer, &subject, &schema_hash, &cid, &9_999_999_999u64);
}

#[test]
fn authorize_then_issue_credential() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    let contract_id = env.register_contract(None, CredentialsIssuer);
    let creds = CredentialsIssuerClient::new(&env, &contract_id);
    creds.initialize_credentials(&admin);
    creds.authorize_issuer(&admin, &issuer);
    assert!(creds.is_authorized_issuer(&issuer));

    let subject = BytesN::from_array(&env, &[7u8; 32]);
    let schema_hash = BytesN::from_array(&env, &[8u8; 32]);
    let cid = String::from_str(&env, "QmCredentialContent00000000000000000000000000");

    assert!(creds.issue_credential(&issuer, &subject, &schema_hash, &cid, &9_999_999_999u64));
}

/// Revocation flips `revoked` to true (issuer must be allow-listed first).
#[test]
fn revoke_credential_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    let contract_id = env.register_contract(None, CredentialsIssuer);
    let creds = CredentialsIssuerClient::new(&env, &contract_id);
    creds.initialize_credentials(&admin);
    creds.authorize_issuer(&admin, &issuer);

    let subject = BytesN::from_array(&env, &[7u8; 32]);
    let schema_hash = BytesN::from_array(&env, &[8u8; 32]);
    let cid = String::from_str(&env, "QmCredentialContent00000000000000000000000000");

    assert!(creds.issue_credential(&issuer, &subject, &schema_hash, &cid, &9_999_999_999u64));

    let stored = creds.get_credential(&subject, &schema_hash).unwrap();
    assert!(!stored.revoked);

    assert!(creds.revoke_credential(&issuer, &subject, &schema_hash));

    let stored = creds.get_credential(&subject, &schema_hash).unwrap();
    assert!(stored.revoked);
}

// ---------------------------------------------------------------------------
// SocialRecovery — guardian configuration auth (C2)
// ---------------------------------------------------------------------------

#[test]
fn set_guardians_ok() {
    let env = Env::default();
    env.mock_all_auths();

    let sk = signing_key();
    let subject = pubkey_of(&env, &sk);
    let caller = Address::generate(&env);
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[9u8; 32])]);

    let contract_id = env.register_contract(None, SocialRecoveryContract);
    let client = SocialRecoveryContractClient::new(&env, &contract_id);

    let sig = sign_ownership(&env, &caller, &subject, &sk);
    assert!(client.set_guardians(&caller, &subject, &guardians, &1u32, &sig));
}

#[test]
#[should_panic]
fn set_guardians_rejects_wrong_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let sk = signing_key();
    let subject = pubkey_of(&env, &sk);
    let caller = Address::generate(&env);
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[9u8; 32])]);

    let contract_id = env.register_contract(None, SocialRecoveryContract);
    let client = SocialRecoveryContractClient::new(&env, &contract_id);

    let bogus = BytesN::from_array(&env, &[0u8; 64]);
    client.set_guardians(&caller, &subject, &guardians, &1u32, &bogus);
}

// ---------------------------------------------------------------------------
// WrappedBadge — relayer allow-list (C4), replay guard (C5), holder (C6)
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "relayer is not authorized")]
fn wrap_badge_requires_authorized_relayer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = Address::generate(&env);
    let contract_id = env.register_contract(None, WrappedBadgeContract);
    let client = WrappedBadgeContractClient::new(&env, &contract_id);
    client.init_wrapped(&admin, &sac);

    let relayer = Address::generate(&env);
    let subject = Address::generate(&env);
    let subject_pubkey = BytesN::from_array(&env, &[1u8; 32]);
    let source_chain_id = 1u32;
    let tx_hash = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmWrapped000000000000000000000000000000000");
    let schema = BytesN::from_array(&env, &[3u8; 32]);

    // `relayer` was never added to the allow-list.
    client.wrap_badge(
        &relayer,
        &subject,
        &subject_pubkey,
        &source_chain_id,
        &tx_hash,
        &cid,
        &schema,
    );
}

#[test]
#[should_panic(expected = "badge already wrapped")]
fn wrap_badge_rejects_duplicate() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = Address::generate(&env);
    let contract_id = env.register_contract(None, WrappedBadgeContract);
    let client = WrappedBadgeContractClient::new(&env, &contract_id);
    client.init_wrapped(&admin, &sac);

    let relayer = Address::generate(&env);
    client.authorize_relayer(&admin, &relayer);

    let subject = Address::generate(&env);
    let subject_pubkey = BytesN::from_array(&env, &[1u8; 32]);
    let source_chain_id = 1u32;
    let tx_hash = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmWrapped000000000000000000000000000000000");
    let schema = BytesN::from_array(&env, &[3u8; 32]);

    // Pre-populate the badge record to simulate a prior wrap of the same tuple.
    let key = DataKey::WrappedBadge(subject_pubkey.clone(), source_chain_id, tx_hash.clone());
    let badge = WrappedBadge {
        subject: subject.clone(),
        subject_pubkey: subject_pubkey.clone(),
        source_chain_id,
        source_tx_hash: tx_hash.clone(),
        cid: cid.clone(),
        asset_code: String::from_str(&env, "WID-00000000"),
        status: WrappedBadgeStatus::Active,
    };
    let set_env = env.clone();
    let set_key = key.clone();
    let set_badge = badge.clone();
    env.as_contract(&contract_id, || {
        set_env.storage().persistent().set(&set_key, &set_badge);
    });

    // The relayer is authorized, but the tuple was already wrapped.
    client.wrap_badge(
        &relayer,
        &subject,
        &subject_pubkey,
        &source_chain_id,
        &tx_hash,
        &cid,
        &schema,
    );
}

#[test]
#[should_panic(expected = "only the badge holder may unwrap")]
fn unwrap_badge_requires_holder() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = Address::generate(&env);
    let contract_id = env.register_contract(None, WrappedBadgeContract);
    let client = WrappedBadgeContractClient::new(&env, &contract_id);
    client.init_wrapped(&admin, &sac);

    let holder = Address::generate(&env);
    let attacker = Address::generate(&env);
    let subject_pubkey = BytesN::from_array(&env, &[1u8; 32]);
    let source_chain_id = 1u32;
    let tx_hash = BytesN::from_array(&env, &[2u8; 32]);

    // Pre-populate a badge owned by `holder`.
    let key = DataKey::WrappedBadge(subject_pubkey.clone(), source_chain_id, tx_hash.clone());
    let badge = WrappedBadge {
        subject: holder.clone(),
        subject_pubkey: subject_pubkey.clone(),
        source_chain_id,
        source_tx_hash: tx_hash.clone(),
        cid: String::from_str(&env, "QmWrapped000000000000000000000000000000000"),
        asset_code: String::from_str(&env, "WID-00000000"),
        status: WrappedBadgeStatus::Active,
    };
    let set_env = env.clone();
    let set_key = key.clone();
    let set_badge = badge.clone();
    env.as_contract(&contract_id, || {
        set_env.storage().persistent().set(&set_key, &set_badge);
    });

    // A non-holder cannot unwrap the badge.
    client.unwrap_badge(&attacker, &subject_pubkey, &source_chain_id, &tx_hash);
}
