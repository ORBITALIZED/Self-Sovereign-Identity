# `#[derive(Arbitrary)]` impls on generated XDR types call `try_size_hint` — RESOLVED

> **Status: RESOLVED** — upstream regression is side-stepped by upgrading to
> `soroban-sdk >= 21.7.7`. The project now pins `=21.7.7` and `cargo build`
>
> - `cargo clippy` pass cleanly without `continue-on-error` workarounds.

## Summary

The `Arbitrary` derive macro that `rs-stellar-xdr` emits for every generated
XDR type produces impls that reference a method called `try_size_hint`. That
method was added to the `arbitrary` crate in **1.4 (Aug 2024)**. When a
downstream crate resolves a version of the `arbitrary` crate that does **not**
expose `try_size_hint`, the generated impls stop compiling and the crate
cannot run `cargo test`.

## Affected versions

- `rs-stellar-xdr` 20.0.x (the regression appears to have shipped in this
  range; we are blocked on the exact same `=20.0.0` baseline as `soroban-sdk`
  =20.0.0).
- Reproduced against `soroban-sdk = \"=20.0.0\"`, `stellar-xdr = \"=20.0.0\"`,
  arbitrary resolves to `<1.4` via Cargo's default-feature resolution.
- **Not reproducible with `soroban-sdk = \"=21.7.7\"`** — the SDK 21.x line
  drops the `arbitrary = "~1.3.0"` pin that was responsible for the breakage.

## Resolution in this project

The fix was to upgrade from `soroban-sdk = "=20.0.0"` to `=21.7.7`:

```diff
- soroban-sdk = "=20.0.0"
+ soroban-sdk = "=21.7.7"
```

This required a matching rustc bump in `rust-toolchain.toml`:

```diff
- channel = "1.85.0"
+ channel = "1.88.0"
```

### What the upgrade fixes

- `cargo build --target wasm32-unknown-unknown --release` — compiles cleanly
- `cargo clippy --target wasm32-unknown-unknown -- -D warnings` — passes
- CI no longer needs `continue-on-error: true` on the Rust build/clippy steps

### What the upgrade does NOT fix

`soroban-sdk 21.7.7` has a **separate** upstream issue in `soroban-env-host`:
a `rand_core` version conflict (`rand_chacha v0.3.1` using `rand_core v0.6`
vs `ed25519-dalek v3.x` using `rand_core v0.10`) that blocks
`cargo test --features testutils`. This is a different regression that would
require migrating to `soroban-sdk 27.x` (with `wasm32v1-none` target) to
resolve.

## Original reproduction (retained for reference)

```toml
# Cargo.toml
[package]
name = "repro"
version = "0.0.0"
edition = "2021"

[lib]
crate-type = ["rlib"]

[dev-dependencies]
soroban-sdk = { version = "=20.0.0", features = ["testutils"] }
```

```rust
// src/lib.rs
#![no_std]
use soroban_sdk::contract;
#[contract]
pub struct Whatever;
```

```bash
cargo test --features testutils
# → thousands of:
#   error[E0599]: no function or associated item named `try_size_hint`
#                 found for struct `stellar_xdr::…` in the current scope
```

## Observed error (verbatim, abbreviated)

```
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `AccountId` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `Curve25519Secret` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `Curve25519Public` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `HmacSha256Key` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `HmacSha256Mac` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `VecM<T, MAX>` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `BytesM<MAX>` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `StringM<MAX>` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `SignerKey` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `Signature` in the current scope
error[E0599]: no function or associated item named `try_size_hint` found
              for struct `NodeId` in the current scope
… ~1,800 total
```

## Why this triggers E0599

`rs-stellar-xdr` emits `#[derive(Arbitrary)]` impls that _call_
`try_size_hint`. `try_size_hint` is a **default-method added to the
`Arbitrary` trait in `arbitrary = 1.4`**. When Cargo resolves any
`arbitrary < 1.4`, the method is gone — so every generated impl that
references it errors with E0599.

## Suggested fixes (any one is acceptable)

1. **Feature-gate the derive:** only emit `#[derive(Arbitrary)]` behind a
   Cargo feature (`arbitrary-impls`) and define that feature to require
   `arbitrary >= 1.4`. Downstream consumers who only need the XDR encode /
   decode surfaces wouldn't pay for fuzzing infrastructure they don't use.
2. **Constrain `Arbitrary` resolution:** in the XDR crate's own
   `[dependencies]`, add `arbitrary = { version = ">=1.4, <2", optional = true }`
   and gate the derive macro on that. Forces a single resolved version.
3. **Bump the SDK's `Cargo.toml.orig`-style pin into `stellar-xdr` itself:**
   explicitly pin `arbitrary = "1.3"` in 20.0.x's `Cargo.toml` so projects
   on `arbitrary <1.4` link against the older `Arbitrary` trait without
   having to add their own `[patch.crates-io]` block.

## Impact

- Direct: every project pinned to `soroban-sdk = "=20.0.0"` loses `cargo
test` on the Soroban contracts (this affects the SSI / Self-Sovereign
  Identity scaffolds, and presumably many other scaffolded Stellar smart-
  contract crates from the SDK 20 launch window).
- Reported count of blocked `cargo test` builds on the public scaffold
  side: ~1,836 compile errors emitted per identical clean build, blocking
  every test target and every clippy/all-targets lint step.
