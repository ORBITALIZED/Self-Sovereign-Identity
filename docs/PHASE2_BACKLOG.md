# 🗺️ Phase 2 — Prioritized Backlog

> Regenerated from a comprehensive audit of all TODOs, FIXMEs, NOTEs, and roadmap items across the entire codebase on **July 15, 2026**.

---

## Priority Definitions

| Priority | Meaning                                             |
| -------- | --------------------------------------------------- |
| **P0**   | Blocking: nothing works end-to-end without it       |
| **P1**   | High value: unlocks a complete user-visible feature |
| **P2**   | Important: needed for production readiness          |
| **P3**   | Polish: hardening, testing, DX improvements         |

---

## 🔴 P0 — End-to-End Contract Wiring ✅ **ALL COMPLETE**

> _Corresponding roadmap item: **Phase 2 — Wire Soroban contract end-to-end → emit events consumed by relayer**_

| #   | Item                                               | Status      | Evidence                                                                                                                                 |
| --- | -------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | **SDK `create()` implementation**                  | ✅ **Done** | Full Soroban tx lifecycle in `packages/sdk/src/stellar/index.ts:210-282` — builds ScVal args, simulates, prepares, signs, submits, polls |
| 0.2 | **SDK `get()` — contract-data key**                | ✅ **Done** | Uses `rpc.simulateTransaction()` with null account. Returns mapped Identity or null. Lines 147-205                                       |
| 0.3 | **API Gateway: forward signed XDR to Soroban**     | ✅ **Done** | `identity.ts:38` — `stellar.submitTransaction(body.signedInvokeXdr)` submits to Soroban RPC                                              |
| 0.4 | **API Gateway: credential routes → Soroban**       | ✅ **Done** | `credentials.ts:22-26` — forwards signedInvokeXdr; GET routes call `stellar.credentials.list()`                                          |
| 0.5 | **Bridge relayer: submit `wrap_badge` to Soroban** | ✅ **Done** | `evm.ts:169-184` — calls `stellar.wrappedBadge.wrap()` with full tx lifecycle                                                            |

---

## 🟠 P1 — Wallet Integration & User-Facing Features ✅ **ALL COMPLETE**

> _Corresponding roadmap item: **Phase 2 — Wallet integration via `@stellar/freighter-api` + wagmi**_

| #   | Item                                | Status      | File(s)                                                                  | Description                                                                                               |
| --- | ----------------------------------- | ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1.1 | **Wallet hydration from Freighter** | ✅ **Done** | `apps/frontend/src/hooks/useWallet.ts`                                   | Replaced mock addresses with real `@stellar/freighter-api` (`getAddress`, `isConnected`, `requestAccess`) |
| 1.2 | **Wallet hydration from wagmi**     | ✅ **Done** | `apps/frontend/src/hooks/useWallet.ts`, `apps/frontend/src/lib/wagmi.ts` | Replaced raw `window.ethereum` with wagmi hooks (`useAccount`, `useConnect`, `useDisconnect`)             |
| 1.3 | **Bridge SSE → EventSource**        | ✅ **Done** | `apps/frontend/src/hooks/useBridge.ts`                                   | Replaced 5s `setInterval` polling with `EventSource` + `/bridge/events/stream` SSE endpoint               |
| 1.4 | **BridgeMonitor SSE consumption**   | ✅ **Done** | `apps/frontend/src/components/BridgeMonitor.tsx`                         | Bridge monitor consumes real SSE events via `useBridge()` hook                                            |
| 1.5 | **Friendbot funding in SDK**        | ✅ **Done** | `apps/frontend/src/lib/stellar.ts`                                       | `fundTestnet()` implemented — calls `https://friendbot.stellar.org?addr=…`                                |

---

## 🟡 P2 — Bridge Relayer & Cross-Chain

> _Corresponding roadmap item: **Phase 2 — Implement Stellar Asset Contract code for wrapped badges (real `WID-…` assets)**_

| #   | Item                                          | Status      | File(s)                                             | Description                                                                                                                                                                |
| --- | --------------------------------------------- | ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **Horizon SSE parsing**                       | ✅ **Done** | `apps/service-bridge-relayer/src/horizon/client.ts` | SSE stream parsed from Horizon's `/events` endpoint (Node fetch + manual parsing in `HorizonStream` class)                                                                 |
| 2.2 | **Stellar Asset Contract for wrapped badges** | ✅ **Done** | `packages/contracts-stellar/src/wrapped_badge.rs`   | SAC integration: `init_wrapped` registers SAC via `env.register_stellar_asset_contract()`; `wrap_badge` mints 1 unit; `unwrap_badge` burns 1 unit via `StellarAssetClient` |

### 🟡 P2 — AI Fraud Detection

> _Corresponding roadmap item: **Phase 2 — Implement AI fraud scorer (logistic regression baseline → gradient boosting)**_

| #   | Item                        | Status      | File(s)                                                               | Description                                                                                                                                                                                                                                   |
| --- | --------------------------- | ----------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **Real feature extraction** | ✅ **Done** | `apps/service-ai-fraud/src/models/fraud_detector.py`                  | 3 placeholder TODOs replaced: `schema_velocity` computed from history, `bio_entropy` via `_shannon_entropy()`, `ip_mismatch` from country comparison                                                                                          |
| 3.2 | **Training pipeline**       | ✅ **Done** | `apps/service-ai-fraud/src/api.py`, `src/store.py`, `src/registry.py` | Full data pipeline: JSONL event store for collecting scored events, `POST /feedback` for labelling, `GET /events` for inspection, `POST /train/from-store` for retraining from accumulated labels, model registry for tracking trained models |

### 🟡 P2 — CI Hardening

> _Corresponding roadmap item: **Phase 2 — CI: GitHub Actions running Rust + Foundry + Vitest + pytest**_

| #   | Item                                   | Status      | File(s)                          | Description                                                                                                                                                     |
| --- | -------------------------------------- | ----------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Remove `continue-on-error` from CI** | ✅ **Done** | `.github/workflows/ci.yml`       | `continue-on-error: true` already removed from all CI steps                                                                                                     |
| 4.2 | **Add SDK Vitest tests to CI**         | ✅ **Done** | `packages/sdk/tests/sdk.test.ts` | 49 tests across all client modules: SSIStellar (submit, identity.create/get, wrappedBadge, credentials), SSIEvm (registry, sbt, bridge), SSIZkp (prove, verify) |
| 4.3 | **Add Stellar cargo test to CI**       | ❌ Pending  | `.github/workflows/ci.yml`       | CI only builds and lints Rust — doesn't run `cargo test`                                                                                                        |
| 4.4 | **Complete Foundry tests in CI**       | ❌ Pending  | `.github/workflows/ci.yml`       | `forge test -vv` runs but additional Solidity tests would improve coverage                                                                                      |

---

## 🟢 P3 — ZK Circuits

> _Corresponding roadmap item: **Phase 2 — Real Circom circuit — `credential.circom` + `age_verification.circom` fully tested**_

| #   | Item                                        | Status     | File(s)                                                 | Description                                                                         |
| --- | ------------------------------------------- | ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 5.1 | **Real witness inputs**                     | ❌ Pending | `packages/zk-circuits/input.json`                       | Replace zero-value placeholders with real Poseidon hashes and Merkle proof elements |
| 5.2 | **Auto-compile circuits in build pipeline** | ❌ Pending | `packages/zk-circuits/test/credential.test.js`          | Integrate `compile.sh` + `setup.sh` into build chain                                |
| 5.3 | **`age_verification.circom` test**          | ❌ Pending | `packages/zk-circuits/circuits/age_verification.circom` | No test file exists for the age circuit yet                                         |
| 5.4 | **`credential.circom` Edge Cases**          | ❌ Pending | `packages/zk-circuits/circuits/credential.circom`       | Test nullifier reuse, invalid Merkle proofs, zero-signature rejection               |

### 🟢 P3 — EVM Contract Auditing

> _Corresponding roadmap item: **Phase 2 — EVM contracts audited (slither + mythril)**_

| #   | Item                            | Status      | File(s)                                          | Description                                                                |
| --- | ------------------------------- | ----------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 6.1 | **Slither static analysis**     | ❌ Pending  | `packages/contracts-evm/`                        | Run `slither .` and fix findings                                           |
| 6.2 | **Mythril symbolic analysis**   | ❌ Pending  | `packages/contracts-evm/`                        | Run `mythril analyze` and fix findings                                     |
| 6.3 | **Complete WrappedBadge tests** | ✅ **Done** | `packages/contracts-evm/test/WrappedBadge.t.sol` | Tests exist for lock, replay protection, non-holder revert, processedLocks |

### 🟢 P3 — Social Recovery Hardening

| #   | Item                           | Status      | File(s)                                                | Description                                                                                      |
| --- | ------------------------------ | ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 7.1 | **Guardian threshold counter** | ✅ **Done** | `packages/contracts-stellar/src/social_recovery.rs:59` | Counter logic implemented: collect N attestations, check threshold, emit recovery_complete event |

### 🟢 P3 — SDK Quality

| #   | Item                          | Status     | File(s)                                | Description                                                                    |
| --- | ----------------------------- | ---------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| 8.1 | **StrKey CRC16 verification** | ❌ Pending | `packages/sdk/src/utils/_strkey.ts:41` | Validate CRC16 checksum on Stellar addresses to catch typos before propagation |
| 8.2 | **EVM SDK client tests**      | ❌ Pending | `packages/sdk/src/evm/index.ts`        | Add unit tests for EVM client methods                                          |
| 8.3 | **ZKP SDK client tests**      | ❌ Pending | `packages/sdk/src/zkp/index.ts`        | Add unit tests for ZKP proving/verification wrappers                           |

---

## 📊 Summary by Package

| Area              | Done   | Pending | Total  |
| ----------------- | ------ | ------- | ------ |
| SDK               | 3      | 2       | 5      |
| API Gateway       | 2      | —       | 2      |
| Frontend          | 5      | —       | 5      |
| Bridge Relayer    | 2      | —       | 2      |
| AI Fraud          | 2      | —       | 2      |
| Stellar Contracts | 2      | —       | 2      |
| EVM Contracts     | 1      | 2       | 3      |
| ZK Circuits       | —      | 4       | 4      |
| CI                | 2      | 1       | 3      |
| **Total**         | **19** | **9**   | **28** |

---

## 🎯 Recommended Execution Order

| Sprint       | Focus                     | Items            | Outcome                                                       |
| ------------ | ------------------------- | ---------------- | ------------------------------------------------------------- |
| **Sprint 1** | P2 — Production readiness | 4.3–4.4          | Stellar cargo test in CI, more Foundry tests                  |
| **Sprint 2** | P3 — ZK Circuits          | 5.1–5.4          | Real witness inputs, auto-compile circuits, edge-case tests   |
| **Sprint 3** | P3 — EVM + SDK polish     | 6.1–6.2, 8.1–8.3 | Slither/Mythril audit, StrKey verification, EVM/ZKP SDK tests |

> **Note:** All P0, P1, and P2 AI Fraud items are now complete — 19 of 28 backlog items done (68%). The end-to-end flow (SDK → Soroban → API → Bridge Relayer → Frontend) is fully wired with real wallets, real SSE, and real fraud features. The AI fraud service has a complete training pipeline (event store, feedback, model registry, train-from-store). The SDK has 49 Vitest tests covering all three client modules.

---

## 📝 Source Audit Trail

This backlog was derived from the following sources across the codebase:

### Roadmap (`docs/ROADMAP.md`)

- Phase 2 items 1–7

### Remaining Code-level TODOs (0 direct matches — all resolved)

All 3 TODO markers in `fraud_detector.py` were resolved in P2.1:

- `schema_velocity` now computed from history parameter
- `bio_entropy` now calls `_shannon_entropy()` from `extract.py`
- `ip_mismatch` now compares `issuer_country` vs `ip_country`

### Architecture NOTES (non-TODO but indicating design context)

| File                                                | Line | Note                                                 |
| --------------------------------------------------- | ---- | ---------------------------------------------------- |
| `packages/contracts-stellar/src/identity.rs`        | 11   | `require_auth()` only on `Address`, not `BytesN<32>` |
| `packages/contracts-stellar/src/credentials.rs`     | 7    | `Address` vs `BytesN<32>` conversion limitation      |
| `packages/contracts-stellar/src/social_recovery.rs` | 8    | Ed25519 verification via `env.crypto()`              |
| `packages/contracts-evm/src/WrappedBadge.sol`       | 40   | Role grant ordering requirement                      |

---

> _Regenerated by the Phase 2 backlog audit on **July 15, 2026**. Last update: **commit 2996a28**._
