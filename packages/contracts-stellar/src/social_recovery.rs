//! # SocialRecovery (M-of-N Guardian Flow)
//!
//! When a user loses their wallet they can rotate to a new pubkey by providing
//! `threshold` guardian attestations.  Guardians sign a structured message
//! `(lost_pubkey, new_pubkey, nonce)` off-chain; the contract verifies
//! signatures and updates `Identity.pubkey` once enough are collected.
//!
//! NOTE: soroban-sdk v20 does **not** expose an `auth::Signature` type.
//! Ed25519 signature verification is performed via `env.crypto().ed25519_verify`.

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, BytesN, Env, Map, Vec};

#[contracttype]
#[derive(Clone)]
pub enum RecoveryKey {
    /// Tracks attestations for a recovery request: (lost_pubkey, new_pubkey, nonce).
    Attestation(BytesN<32>, BytesN<32>, u64),
}

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
        // For M-of-N guardian management the subject authenticates as an Address.
        // BytesN<32> cannot call require_auth directly; the caller must ensure
        // they pass an Address that authorises this operation at the invoke layer.
        if threshold == 0 || threshold > guardians.len() {
            panic!("invalid threshold");
        }
        env.storage().persistent().set(
            &crate::storage::DataKey::Recovery(subject),
            &(guardians, threshold),
        );
        true
    }

    /// Submit a guardian attestation with an Ed25519 signature.
    ///
    /// `signature` is a 64-byte raw Ed25519 signature over the message
    /// produced by [`message`].  The contract verifies it via the Soroban host
    /// built-in `env.crypto().ed25519_verify`.
    pub fn attest_recovery(
        env: Env,
        guardian: BytesN<32>,
        lost_pubkey: BytesN<32>,
        new_pubkey: BytesN<32>,
        nonce: u64,
        signature: BytesN<64>,
    ) -> bool {
        // 1. Build the message the guardian signed.
        let msg = message(&env, lost_pubkey.clone(), new_pubkey.clone(), nonce);

        // 2. Verify the Ed25519 signature using the Soroban host crypto built-in.
        //    `ed25519_verify(public_key, message, signature)` panics on failure.
        env.crypto().ed25519_verify(&guardian, &msg, &signature);

        // 3. Track which guardian attested to prevent double-counting.
        let att_key = RecoveryKey::Attestation(
            lost_pubkey.clone(),
            new_pubkey.clone(),
            nonce,
        );

        // Attestations map: guardian pubkey → has attested (bool).
        // Count map: total number of attestations collected so far.
        let mut att_map: Map<BytesN<32>, bool> = env
            .storage()
            .persistent()
            .get(&att_key)
            .unwrap_or(Map::new(&env));

        if att_map.get(guardian.clone()).unwrap_or(false) {
            panic!("guardian already attested for this recovery request");
        }
        att_map.set(guardian.clone(), true);
        env.storage().persistent().set(&att_key, &att_map);

        let attestation_count = att_map.len();

        // 4. Check if threshold has been met.
        let recovery_data: (Vec<BytesN<32>>, u32) = env
            .storage()
            .persistent()
            .get(&crate::storage::DataKey::Recovery(lost_pubkey.clone()))
            .expect("no recovery configuration for this identity");

        let (guardians, threshold) = recovery_data;

        // Verify the guardian is in the configured guardian set.
        let mut is_guardian = false;
        for g in guardians.iter() {
            if g == guardian {
                is_guardian = true;
                break;
            }
        }
        if !is_guardian {
            panic!("signer is not a configured guardian");
        }

        // Emit the attestation event.
        env.events()
            .publish(("recovery_attest",), (guardian, new_pubkey.clone(), attestation_count, threshold));

        // If threshold is reached, emit recovery_complete and clean up
        // attestation data. The bridge relayer observes this event and
        // calls IdentityRegistry to perform the actual pubkey rotation
        // (Soroban contracts have isolated storage — SocialRecovery
        // cannot directly modify IdentityRegistry's state).
        if attestation_count >= threshold {
            env.events()
                .publish(
                    ("recovery_complete",),
                    (
                        lost_pubkey.clone(),
                        new_pubkey.clone(),
                        attestation_count,
                        threshold,
                    ),
                );

            // Clean up attestation data for this recovery request.
            env.storage().persistent().remove(&att_key);
        }

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
