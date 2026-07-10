# `cargo test` broken for any project pinned to `soroban-sdk = "=20.0.0"`

## Summary

A regression in the `stellar-xdr` 20.0.x `Arbitrary` derive bleed through
to `soroban-sdk = "=20.0.0"`, blocking every `cargo test` invocation that
exercises the testutils profile. The SDK's newer releases (e.g. v23.4.0,
v26.1.0) sidestep the breakage by pinning `arbitrary = "~1.3.0"` in their
published `Cargo.toml.orig`; **the SDK 20 line never received that pin**, so
every consumer who locked to the SDK 20 line in order to wait for
stabilisation is stuck with ~1,800 E0599 compile errors and no test target.

This issue is filed specifically against `rs-soroban-sdk` so the SDK 20 line
can either (a) backport the `arbitrary` pin from the newer releases, or
(b) release a 20.x.y patch that bundles a fixed `stellar-xdr` version with
the derive macro properly gated.

## Affected versions

- `soroban-sdk = "=20.0.0"` (the most common pin in scaffolds and forks
  that branched off Protocol 20).
- Affected crates on the consumer side: anything that registers a contract
  with `env.register_contract(...)` and has a `[lib]`-level test file —
  i.e. essentially every Soroban contract project that has a `tests/`
  folder.

## Reproduction (minimum viable)

```toml
# packages/contracts/Cargo.toml
[package]
name = "repro-soroban"
version = "0.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[features]
testutils = ["soroban-sdk/testutils"]

[dependencies]
soroban-sdk = "=20.0.0"

[dev-dependencies]
soroban-sdk = { version = "=20.0.0", features = ["testutils"] }
```

```rust
// src/lib.rs
#![no_std]
use soroban_sdk::contract;
#[contract]
pub struct Repro;
```

```bash
cargo test --features testutils
# → ~1,836 error[E0599]s, all touching stellar_xdr XDR types
#   (AccountId, Curve25519Secret, Curve25519Public, HmacSha256Key/Mac,
#    VecM<T, MAX>, BytesM<MAX>, StringM<MAX>, SignerKey, Signature, NodeId).
```

Same failure mode on `cargo build --target wasm32-unknown-unknown
--release` is **not** triggered (the `Arbitrary` derive is only pulled in
on the test target), so release-wasm builds remain green, which is why this
went unnoticed until 20.x consumers tried to run their first integration
test.

## Observed error signature (one example of ~1,800)

```
error[E0599]: no function or associated item named `try_size_hint`
              found for struct `stellar_xdr::VecM<T, MAX>` in the
              current scope

   --> …/stellar-xdr-20.0.0/src/generated.rs:…
```

`try_size_hint` was added to the `arbitrary` crate's `Arbitrary` trait
in version 1.4 (Aug 2024). The Cargo resolver picks `arbitrary = 1.3.x`
by default for the 20.x line, so every XDR type's derived `Arbitrary`
impl references a method that does not exist in the resolved trait.

## Suggested fixes (preferred order)

1. **Backport the `arbitrary = "~1.3.0"` pin** from the modern SDK tree
   (v23.4.0+, `Cargo.toml.orig` confirms the pin is exactly `~1.3.0`) into
   `soroban-sdk` 20.x's `[dev-dependencies]`. This is a one-line patch
   release, ships fast, and matches the workaround newer releases already
   use. Crucially: keeps the resolved `arbitrary` _consistent across all
   consumers of the SDK 20 line_ without forcing them to add their own
   workspace-level `[patch.crates-io]`.
2. **Coordinate with `rs-stellar-xdr`** to either (a) feature-gate the
   `Arbitrary` derive behind a non-default feature, or (b) add the same
   `arbitrary` pin to `stellar-xdr` itself. Either approach is upstream-
   correct and would let downstream patch their `[lib] test = false` flag
   back to `true` as described in our repo's `Cargo.toml` comment.
3. **Release a 20.x.y patch** that bumps `stellar-xdr` to a fixed minor
   version (e.g. 20.0.1, 20.0.2) where the `Arbitrary` derive is properly
   constrained. This is the cleanest fix for consumers who do not want to
   add any workspace patch.

## Workaround (downstream, in our repo today)

We added a regression-detect script (`scripts/check-stellar-xdr-fix.sh`)
and a CI sentinel job that runs the script on every push/PR to the
Soroban contract crate. The script exits 0 the moment the upstream fix
ships (cargo test green + no E0599/try_size_hint signature in the log)
and exits 1 today (so the sentinel job is red today, and turns green on
the fix). This way the team is paged automatically the moment any of
the three fixes above lands.

We also keep `[lib] test = false` in
`packages/contracts-stellar/Cargo.toml` to keep the WASM release build
green; flipping it back to `true` is queued behind the upstream fix.

## Impact

- **Every** Soroban contract project on the 20.0.0 pin loses `cargo test`.
- The CI pattern that catches it (clippy --all-targets) is also broken
  because `clippy --all-targets` is itself a superset of `cargo test` in
  terms of compile targets.
- The release WASM build (`cargo build --target wasm32-unknown-unknown
--release`) is unaffected, which is why the bug was not caught by users
  who only ever build the WASM target.

## Environment

- `cargo` 1.85.0
- `soroban-sdk = "=20.0.0"`
- `stellar-xdr = "=20.0.0"` (resolved transitively)
- `arbitrary = "1.3.x"` (default-resolved)

## Cross-references

- Parallel issue filed on `stellar/rs-stellar-xdr` calling out the upstream
  `#[derive(Arbitrary)]` macro itself as the source of the broken
  generated impls.
