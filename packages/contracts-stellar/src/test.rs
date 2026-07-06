//! On-chain integration tests.
//! Run with:  `cargo test --features testutils`

#![cfg(test)]

use soroban_sdk::{BytesN, Env, String, Vec};

use crate::identity::{Identity, IdentityRegistry, IdentityRegistryClient};

#[test]
fn create_and_get_identity() {
    let env = Env::default();
    let admin = soroban_sdk::Address::from_string(&String::from_str(&env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"));
    let contract_id = env.register_contract(None, IdentityRegistry);
    let client = IdentityRegistryClient::new(&env, &contract_id);

    client.initialize(&admin);

    // TODO: replace with a real keypair once we wire up a sandbox key generator.
    let pk = BytesN::from_array(&env, &[1u8; 32]);
    let commit = BytesN::from_array(&env, &[2u8; 32]);
    let cid = String::from_str(&env, "QmScaffoldPlaceholderCid0000000000000000000000");
    let guardians: Vec<BytesN<32>> = Vec::from_array(&env, [BytesN::from_array(&env, &[3u8; 32])]);

    let ok = client.create_identity(&pk, &commit, &cid, &guardians);
    assert!(ok);

    let stored: Option<Identity> = client.get_identity(&pk);
    assert!(stored.is_some());
    let id = stored.unwrap();
    assert_eq!(id.biometric_commitment, commit);
}
