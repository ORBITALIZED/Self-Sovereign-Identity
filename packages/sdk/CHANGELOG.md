# Changelog

All notable changes to `@ssi/sdk` are documented in this file. The
project follows [Semantic Versioning](https://semver.org/).

## [0.1.1] — 2026-07-14

### Added

- `constants.ts` — central place for Stellar network passphrases, well-known EVM
  chain IDs, the wrapped-badge asset-code prefix, and HTTP / Soroban RPC
  default timeouts.
- `utils/typeGuards.ts` — runtime type guards (`isStellarPubKey`,
  `isStellarStrKey`, `isEvmAddress`, `isHash32`) for safer input validation
  at SDK boundaries.
- `utils/retry.ts` — generic `retry(fn, opts)` helper with exponential
  backoff, a configurable predicate and an `onRetry` hook for logging.
- Expanded JSDoc on `SSIStellar`, `SSIEvm` and `SSIZkp` plus their sub-clients.

## [0.1.0] — initial scaffold

- Stellar sub-client wrapping `get_identity`, `create_identity`, `wrap_badge`,
  `get_wrapped_badge` and `list_credentials` via read-only simulation.
- EVM sub-client typed against viem for `IdentityRegistry`, `IdentitySBT`
  and `WrappedBadge`.
- ZK sub-client (`prove`, `verify`) wrapping snarkjs lazily.
- StrKey / base64url / sha256 encoding helpers, plus discriminated
  `AnyEvent` types for Soroban contract events.
