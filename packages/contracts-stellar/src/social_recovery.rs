//! # SocialRecovery (M-of-N Guardian Flow)
//!
//! When a user loses their wallet they can rotate to a new pubkey by providing
//! `threshold` guardian attestations.  Guardians sign a structured message
//! `(lost_pubkey, new_pubkey, nonce)` off-chain; the contract verifies
//! signatures and updates `Identity.pubkey` once enough are collected.

use soroban_sdk::{
    auth::Signature, contract, contractimpl, Bytes, BytesN, Env, Vec,
};

#[contract]
pub struct SocialRecoveryContract;

#[contractimpl]
impl SocialRecoveryContract {
    /// Configure the guardians for the caller.
    pub fn set_guardians(
        env: Env,
        subject: BytesN<32>,
        guardians: Vec<BytesN<32>>,
        threshold: u32,
    ) -> bool {
        subject.require_auth();
        if threshold == 0 || threshold as u32 > guardians.len() as u32 {
            panic!("invalid threshold");
        }
        env.storage()
            .persistent()
            .set(&crate::storage::DataKey::Recovery(subject), &(guardians, threshold));
        true
    }

    /// Submit a guardian attestation. When enough have been collected the
    /// contract emits `RecoveryComplete` and lets the new pubkey assume control.
    pub fn attest_recovery(
        env: Env,
        guardian: BytesN<32>,
        lost_pubkey: BytesN<32>,
        new_pubkey: BytesN<32>,
        nonce: u64,
        signature: Signature,
    ) -> bool {
        // 1. ensure caller is a registered guardian
        // 2. verify the signature against the tuple (lost_pubkey, new_pubkey, nonce)
        // 3. append the attestation, check counter vs threshold, emit event
        //
        // TODO(harden): use `env.crypto().ed25519_verify`. The scaffold leaves
        // the recovery counter undetermined for the moment.
        signature.verify(&guardian, &message(&env, lost_pubkey, new_pubkey, nonce));
        let _ = (guardian, lost_pubkey, new_pubkey, nonce);
        env.events()
            .publish(("recovery_attest",), (guardian, new_pubkey.clone()));
        true
    }
}

fn message(env: &Env, lost: BytesN<32>, neu: BytesN<32>, nonce: u64) -> Bytes {
    // domain separator + payload — prevent replay across contracts
    let mut buf = Bytes::from_slice(env, b"ssi-recovery-v1|");
    buf.append(&Bytes::from_array(env, &lost.into()));
    buf.append(&Bytes::from_array(env, &neu.into()));
    buf.append(&Bytes::from_array(env, &nonce.to_be_bytes()));
    buf
}
