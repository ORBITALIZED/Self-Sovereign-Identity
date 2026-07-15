//! # WrappedBadge
//!
//! Wraps a Soulbound Token issued on a foreign chain (Ethereum, Polygon, …)
//! as a Stellar-native asset via the Stellar Asset Contract (SAC).
//!
//! Asset code: `WID-<schema_hash_prefix>` (12 chars total — Stellar's
//! classic asset-code limit).
//!
//! Flow:
//!  1. EVM SBT is minted (or burned-then-emitted) on source chain.
//!  2. Bridge relayer submits `wrap_badge(subject, source_chain_id, source_tx, cid)`.
//!  3. Contract mints 1 unit of the WID-* Stellar asset to the subject via SAC.
//!  4. The holder can use the token in Stellar-native apps, or `unwrap_badge`
//!     it back to its origin chain (burns the SAC token).

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, String,
};

use crate::storage::{emit_event, DataKey};

#[contracttype]
#[derive(Clone, Debug)]
pub enum WrappedBadgeStatus {
    Active,
    Burned,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WrappedBadge {
    pub subject_pubkey: BytesN<32>,
    pub source_chain_id: u32,
    pub source_tx_hash: BytesN<32>,
    pub cid: String,
    pub asset_code: String,
    pub status: WrappedBadgeStatus,
}

#[contract]
pub struct WrappedBadgeContract;

/// Amount of the Stellar Asset to mint/burn per badge (1 token with 7 decimals).
const BADGE_AMOUNT: i128 = 1_0000000;

#[contractimpl]
impl WrappedBadgeContract {
    /// Initialise the contract and register a Stellar Asset Contract (SAC)
    /// for the wrapped badge asset. The WrappedBadge contract itself is the
    /// SAC admin, so it can autonomously mint (on wrap) and burn (on unwrap)
    /// without requiring a separate admin signature for each operation.
    pub fn init_wrapped(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        // The SAC admin is the WrappedBadge contract itself, so the contract
        // can mint/burn autonomously when its own functions are called by
        // authorised parties (relayer for wrap, holder for unwrap).
        let contract_addr = Address::from_contract_id(&env.current_contract_id());
        let sac_id = env.register_stellar_asset_contract(&contract_addr);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::StellarAsset, &sac_id);
    }

    /// Mint a wrapped badge for a subject originating on `source_chain_id`.
    ///
    /// Creates a WID-* Stellar asset record AND mints 1 unit of the
    /// corresponding SAC token to the subject's Stellar address.
    pub fn wrap_badge(
        env: Env,
        relayer: Address,
        subject_pubkey: BytesN<32>,
        source_chain_id: u32,
        source_tx_hash: BytesN<32>,
        cid: String,
        schema_hash: BytesN<32>,
    ) -> bool {
        relayer.require_auth();

        let asset_code = build_asset_code(&env, &schema_hash);
        let badge = WrappedBadge {
            subject_pubkey: subject_pubkey.clone(),
            source_chain_id,
            source_tx_hash: source_tx_hash.clone(),
            cid,
            asset_code: asset_code.clone(),
            status: WrappedBadgeStatus::Active,
        };

        let key = DataKey::WrappedBadge(
            subject_pubkey.clone(),
            source_chain_id,
            source_tx_hash.clone(),
        );
        env.storage().persistent().set(&key, &badge);

        // Mint 1 unit of the Stellar Asset to the subject's address.
        let sac_id: soroban_sdk::BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::StellarAsset)
            .expect("SAC not initialised — call init_wrapped first");
        let subject_addr = Address::from_account_id(&soroban_sdk::AccountId(subject_pubkey.clone()));
        token::StellarAssetClient::new(&env, &sac_id).mint(&subject_addr, &BADGE_AMOUNT);

        emit_event(
            &env,
            ("badge_wrapped",),
            (subject_pubkey, source_chain_id, source_tx_hash, asset_code),
        );
        true
    }

    /// Burn the wrapped badge when the holder wants to unwrap back to source.
    /// Destroys 1 unit of the SAC token held by the caller.
    pub fn unwrap_badge(
        env: Env,
        caller: soroban_sdk::Address,
        subject_pubkey: BytesN<32>,
        source_chain_id: u32,
        source_tx_hash: BytesN<32>,
    ) -> bool {
        caller.require_auth();

        let key = DataKey::WrappedBadge(
            subject_pubkey.clone(),
            source_chain_id,
            source_tx_hash.clone(),
        );
        let mut badge: WrappedBadge = env
            .storage()
            .persistent()
            .get(&key)
            .expect("wrapped badge not found");

        badge.status = WrappedBadgeStatus::Burned;
        env.storage().persistent().set(&key, &badge);

        // Burn 1 unit of the Stellar Asset from the caller.
        let sac_id: soroban_sdk::BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::StellarAsset)
            .expect("SAC not initialised");
        token::StellarAssetClient::new(&env, &sac_id).burn(&caller, &BADGE_AMOUNT);

        emit_event(
            &env,
            ("badge_unwrapped",),
            (subject_pubkey, source_chain_id, source_tx_hash),
        );
        true
    }

    pub fn get_wrapped_badge(
        env: Env,
        subject_pubkey: BytesN<32>,
        source_chain_id: u32,
        source_tx_hash: BytesN<32>,
    ) -> Option<WrappedBadge> {
        env.storage().persistent().get(&DataKey::WrappedBadge(
            subject_pubkey,
            source_chain_id,
            source_tx_hash,
        ))
    }
}

/// Stellar asset codes are at most 12 ASCII chars:
///   "WID-" + 8 uppercase hex chars taken from the first 4 bytes of the
///   schema hash (12 bytes total — fits the Stellar asset-code limit).
fn build_asset_code(env: &Env, schema_hash: &BytesN<32>) -> String {
    // Start from the literal ASCII bytes "WID-" so we never need to pull
    // `alloc::String` from `std` (which would break Soroban compilation).
    let mut buf = *b"WID-00000000";
    let raw = schema_hash.to_array();
    for i in 0..4 {
        buf[4 + i * 2] = nibble_to_hex((raw[i] >> 4) & 0x0f);
        buf[4 + i * 2 + 1] = nibble_to_hex(raw[i] & 0x0f);
    }
    // Safety: every byte came either from an ASCII literal or nibble_to_hex,
    // so the buffer is always valid UTF-8.
    String::from_str(env, core::str::from_utf8(&buf).unwrap())
}

fn nibble_to_hex(n: u8) -> u8 {
    match n {
        0..=9 => b'0' + n,
        10..=15 => b'A' + (n - 10),
        _ => b'0',
    }
}
