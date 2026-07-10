#![no_std]

//! # Self-Sovereign Identity — Soroban contracts
//!
//! The contract suite is grouped into four modules:
//!
//! * [`identity`]       — IdentityRegistry: create / update / recover identities
//! * [`credentials`]    — Issue / revoke / reveal credentials
//! * [`wrapped_badge`]  — Wrap EVM Soulbound badges as Stellar assets
//! * [`social_recovery`]— M-of-N guardian recovery
//!
//! Build to wasm with:  `cargo build --target wasm32-unknown-unknown --release`

pub mod credentials;
pub mod identity;
pub mod social_recovery;
pub mod storage;
pub mod wrapped_badge;

// Public re-exports of every sub-contract's client.
pub use credentials::CredentialsIssuerClient;
pub use identity::IdentityRegistryClient;
pub use wrapped_badge::WrappedBadgeContractClient;

#[cfg(test)]
mod test;
