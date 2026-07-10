# `#[derive(Arbitrary)]` impls on generated XDR types call `try_size_hint`, undefined on `arbitrary` < 1.4

## Summary

The `Arbitrary` derive macro that `rs-stellar-xdr` emits for every generated
XDR type produces impls that reference a method called `try_size_hint`. That
method was added to the `arbitrary` crate in **1.4 (Aug 2024)**. When a
downstream crate resolves a version of the `arbitrary` crate that does **not**
expose `try_size_hint`, the generated impls stop compiling and the crate
cannot run `cargo test`.

This blocks `cargo test` for any project pinned (directly or via
`soroban-sdk`) to a `stellar-xdr` 20.0.x. Newer `soroban-sdk` releases
sidestep the breakage by pinning `arbitrary = "~1.3.0"` in their
`Cargo.toml.orig` — so the maintainers are already aware of the interaction,
but downstream consumers locked to the SDK 20 line (e.g. anything that pins
`soroban-sdk = "=20.0.0"`) cannot pick up that workaround without an
`[patch.crates-io]` shim.

## Affected versions

- `rs-stellar-xdr` 20.0.x (the regression appears to have shipped in this
  range; we are blocked on the exact same `=20.0.0` baseline as `soroban-sdk`
  =20.0.0).
- Reproduced against `soroban-sdk = "=20.0.0"`, `stellar-xdr = "=20.0.0"`,
  arbitrary resolves to `<1.4` via Cargo's default-feature resolution.

## Reproduction (minimum viable)

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

## Workaround (downstream)

A workspace-level patch works around the breakage until the upstream
emits a fix:

```toml
# Cargo.toml (workspace root)
[patch.crates-io]
arbitrary = { version = "=1.3.2" }
```

Caveat: this only works if downstream does NOT depend on a Stellar XDR
sub-feature that requires `arbitrary >= 1.4`. Today nothing in 20.0.x does,
so the patch is safe.

## Impact

- Direct: every project pinned to `soroban-sdk = "=20.0.0"` loses `cargo
test` on the Soroban contracts (this affects the SSI / Self-Sovereign
  Identity scaffolds, and presumably many other scaffolded Stellar smart-
  contract crates from the SDK 20 launch window).
- Reported count of blocked `cargo test` builds on the public scaffold
  side: ~1,836 compile errors emitted per identical clean build, blocking
  every test target and every clippy/all-targets lint step.

## Environment

- `cargo` 1.85.0 (rust-toolchain.toml pinned in downstream repo)
- `soroban-sdk = "=20.0.0"`
- `stellar-xdr = "=20.0.0"` (resolved transitively by `soroban-sdk`)
- `arbitrary = "1.3.2"` (resolved by Cargo's default-feature selection)

## Cross-references

- Downstream consumer ticket (project-side): see also the parallel issue
  filed on `stellar/rs-soroban-sdk` requesting an upstream SDK 20.x patch
  release that bundles either of the fixes above, so downstream consumers
  can drop the workspace `[patch.crates-io]` shim.
