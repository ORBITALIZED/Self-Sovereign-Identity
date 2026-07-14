# Changelog

All notable changes across the Self-Sovereign Identity monorepo are
documented in this file. Each package also keeps its own changelog
(`packages/sdk/CHANGELOG.md` is the template). Dates reflect UTC commit
dates.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com),
and the project follows [Semantic Versioning](https://semver.org/) for the
SDK (`@ssi/sdk`) sub-packages.

## [Unreleased] — polish batch 2026-07-14

### Added (apps/frontend)

- `Spinner` UI primitive with `sm` / `md` / `lg` / `xl` size variants and
  a screen-reader label.
- `Toast` UI primitive with `info` / `success` / `warning` / `error`
  variants and an auto-dismiss timer.
- `Skeleton` UI primitive used by the Dashboard identity-card placeholder.
- `Logo`, `ErrorBoundary`, `ScrollToTop` shared components.
- `useCopyToClipboard` hook.
- Skip-to-main-content link in `Layout` + `id="main-content"` on `<main>`.
- `aria-live` / `aria-label` on the new spinner and toast; `sr-only`
  labels preserved across the surface.

### Added (packages/sdk)

- `constants.ts` with `NETWORK_PHRASE`, `EVM_CHAIN_ID`, `WRAPPED_ASSET_PREFIX`,
  `DEFAULT_TX_TIMEOUT_MS`, `DEFAULT_HTTP_TIMEOUT_MS`.
- `utils/typeGuards.ts` — runtime guards for `StellarPubKey`, strkey,
  `EvmAddress`, `Hash32`.
- `utils/retry.ts` — exponential-backoff retry with `onRetry` hook.
- Unit tests for the new helpers (`vitest`).
- JSDoc on `SSIStellar`, `SSIEvm` and `SSIZkp`.
- New `"./utils"` sub-path export in `package.json`.
- `CHANGELOG.md` for the SDK; SDK bumped to `0.1.1`.

### Added (packages/contracts-evm)

- NatSpec comments on `lockAndNotify`, `registerIssuer`, `revokeIssuer`,
  `registerSchema`, `attest`, `isIssuer`, `isSchema`, and the `BadgeLocked`
  event.
- Custom errors `NotHolder()`, `ReplayLock()`, `AlreadyRegistered(addr)`,
  `SchemaAlreadyRegistered(hash)`.
- New test suite for `IdentityRegistry` (`test/IdentityRegistry.t.sol`).
- `slither.config.json` with documented filter keys.
- Replacement of string-typed `require` calls with named custom errors in
  `WrappedBadge` and `IdentityRegistry`.

### Added (packages/contracts-stellar)

- Comprehensive rustdoc on every public method of `IdentityRegistry`,
  `CredentialsIssuer` and the existing helpers.
- `get_credentials_count` helper on `CredentialsIssuer`.
- TTL refresh on `rotate_biometric` via `touch_identity`.
- `revoke_credential_flow` integration test under `src/test.rs`.
- `[lints.clippy]` table in `Cargo.toml`.
- `.rustfmt.toml` baseline config.

### Added (packages/zk-circuits)

- `scripts/witness-credential.sh` and `scripts/witness-age.sh` for
  reproducible witness generation.
- `input-age.json` sample fixture for the age-verification circuit.

### Added (apps/api-gateway)

- Request-id middleware with client-validated echo, included in every
  response's `X-Request-Id` header.
- Env-driven CORS allow-list (`CORS_ORIGINS=…`).
- New `GET /ready` route that probes Stellar Horizon with a 1.5s timeout.
- Structured error handler — every error returns `{ error, message,
requestId, retryable, details? }` with a stable code.
- Vitest tests for the request-id middleware.

### Added (apps/service-ipfs)

- `utils/retry.ts` retry helper for transient Helia failures.
- Strict base64 validation in `/pin` (rejects invalid alphabet, silently-
  truncated input, oversized payloads).

### Added (apps/service-bridge-relayer)

- `src/health.ts` — a `node:http` server exposing `GET /health` with
  config-readiness + EVM-bootstrap status. Container probes can use it
  without bringing in a web framework.

### Added (apps/service-ai-fraud)

- `tests/conftest.py` with `client`, `heuristic`, and `maybe_model`
  fixtures.
- `tests/test_api.py` — smoke tests for `/health` and `/score`.
- `tests/test_heuristic.py` — unit tests for the deterministic
  fallback detector.

### Changed

- `WrappedBadge` now uses custom errors instead of `require` strings.
- `IdentityRegistry` distinguishes admin-calls from registration-conflict
  reverts via named errors.
- `IdentityRegistry.revokeIssuer` keeps existing credentials on-chain;
  only future issuance is blocked.
- `@ssi/sdk` bumped to `0.1.1`.
