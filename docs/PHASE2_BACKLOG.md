# 🗺️ Phase 2 — Prioritized Backlog

> Generated from a comprehensive audit of all TODOs, FIXMEs, NOTEs, and roadmap items across the entire codebase on **July 10, 2026**.

---

## Priority Definitions

| Priority | Meaning                                             |
| -------- | --------------------------------------------------- |
| **P0**   | Blocking: nothing works end-to-end without it       |
| **P1**   | High value: unlocks a complete user-visible feature |
| **P2**   | Important: needed for production readiness          |
| **P3**   | Polish: hardening, testing, DX improvements         |

---

## 🔴 P0 — End-to-End Contract Wiring

> _Corresponding roadmap item: **Phase 2 — Wire Soroban contract end-to-end → emit events consumed by relayer**_

| #   | Item                                               | File(s)                                               | Description                                                                                                          |
| --- | -------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0.1 | **SDK `create()` implementation**                  | `packages/sdk/src/stellar/index.ts:88-89`             | `build invokeHostFunctionOp, simulate, assemble, sign & submit` — currently `throw new Error("not implemented yet")` |
| 0.2 | **SDK `get()` — contract-data key**                | `packages/sdk/src/stellar/index.ts:73`                | Build the correct ledger key for `(contractId, "Identity", pubkey)` instead of returning `null`                      |
| 0.3 | **API Gateway: forward signed XDR to Soroban**     | `apps/api-gateway/src/routes/identity.ts:34`          | Submit `body.signedInvokeXdr` to the Soroban RPC instead of echoing it back                                          |
| 0.4 | **API Gateway: credential routes → Soroban**       | `apps/api-gateway/src/routes/credentials.ts:15,21`    | Forward issue & list to Soroban via SDK                                                                              |
| 0.5 | **Bridge relayer: submit `wrap_badge` to Soroban** | `apps/service-bridge-relayer/src/listeners/evm.ts:60` | After fraud check, actually mint the wrapped badge on Soroban                                                        |

---

## 🟠 P1 — Wallet Integration & User-Facing Features

> _Corresponding roadmap item: **Phase 2 — Wallet integration via `@stellar/freighter-api` + wagmi**_

| #   | Item                                | File(s)                                             | Description                                                     |
| --- | ----------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 1.1 | **Wallet hydration from Freighter** | `apps/frontend/src/hooks/useWallet.ts:10`           | Replace mock addresses with real `@stellar/freighter-api` calls |
| 1.2 | **Wallet hydration from wagmi**     | `apps/frontend/src/hooks/useWallet.ts:10`           | Replace mock addresses with real wagmi `getAccount`             |
| 1.3 | **Bridge SSE → EventSource**        | `apps/frontend/src/hooks/useBridge.ts:17`           | Open real `EventSource('/api/bridge/ws')` instead of empty stub |
| 1.4 | **BridgeMonitor real Horizon SSE**  | `apps/frontend/src/components/BridgeMonitor.tsx:25` | Replace the fake `setInterval` buffer with real SSE consumption |
| 1.5 | **Friendbot funding in SDK**        | `apps/frontend/src/lib/stellar.ts:37`               | Implement `fundTestnet` via Stellar Friendbot HTTP endpoint     |

---

## 🟡 P2 — Bridge Relayer & Cross-Chain

> _Corresponding roadmap item: **Phase 2 — Implement Stellar Asset Contract code for wrapped badges (real `WID-…` assets)**_

| #   | Item                                          | File(s)                                                | Description                                                                               |
| --- | --------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 2.1 | **Horizon SSE parsing**                       | `apps/service-bridge-relayer/src/horizon/client.ts:23` | Parse the SSE stream from Horizon's `/events` endpoint (Node fetch + manual parsing)      |
| 2.2 | **Stellar Asset Contract for wrapped badges** | `packages/contracts-stellar/src/wrapped_badge.rs`      | Implement real `WID-*` Stellar assets via SAC integration (currently just stores records) |

### 🟡 P2 — AI Fraud Detection

> _Corresponding roadmap item: **Phase 2 — Implement AI fraud scorer (logistic regression baseline → gradient boosting)**_

| #   | Item                        | File(s)                                                    | Description                                                                             |
| --- | --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 3.1 | **Real feature extraction** | `apps/service-ai-fraud/src/models/fraud_detector.py:35-37` | Replace placeholder features (velocity, entropy, IP mismatch) with real implementations |
| 3.2 | **Training pipeline**       | `apps/service-ai-fraud/src/api.py:52`                      | Implement `/train` endpoint (logistic regression baseline → gradient boosting)          |

### 🟡 P2 — CI Hardening

> _Corresponding roadmap item: **Phase 2 — CI: GitHub Actions running Rust + Foundry + Vitest + pytest**_

| #   | Item                                         | File(s)                          | Description                                                                                                |
| --- | -------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4.1 | **Remove `continue-on-error` from CI**       | `.github/workflows/ci.yml:66`    | Once P0/P1 items are done, remove `continue-on-error: true` from typecheck, build, test, lint, cargo steps |
| 4.2 | **Add SDK Vitest tests to CI**               | `packages/sdk/tests/sdk.test.ts` | Current tests only cover encoding utils — need tests for Stellar/EVM/ZKP clients                           |
| 4.3 | **Add Stellar cargo test to CI**             | `.github/workflows/ci.yml`       | CI currently only builds and lints Rust — doesn't run `cargo test`                                         |
| 4.4 | **Add Foundry test to CI with solidity job** | `.github/workflows/ci.yml`       | `forge test -vv` runs but `test_lock_replay_protected` is incomplete                                       |

---

## 🟢 P3 — ZK Circuits

> _Corresponding roadmap item: **Phase 2 — Real Circom circuit — `credential.circom` + `age_verification.circom` fully tested**_

| #   | Item                                        | File(s)                                                 | Description                                                                                     |
| --- | ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 5.1 | **Real witness inputs**                     | `packages/zk-circuits/input.json`                       | Replace zero-value placeholders with real Poseidon hashes and Merkle proof elements             |
| 5.2 | **Auto-compile circuits in build pipeline** | `packages/zk-circuits/test/credential.test.js`          | Currently skips if artifacts don't exist — integrate `compile.sh` + `setup.sh` into build chain |
| 5.3 | **`age_verification.circom` test**          | `packages/zk-circuits/circuits/age_verification.circom` | No test file exists for the age circuit yet                                                     |
| 5.4 | **`credential.circom` Edge Cases**          | `packages/zk-circuits/circuits/credential.circom`       | Test nullifier reuse, invalid Merkle proofs, zero-signature rejection                           |

### 🟢 P3 — EVM Contract Auditing

> _Corresponding roadmap item: **Phase 2 — EVM contracts audited (slither + mythril)**_

| #   | Item                            | File(s)                                          | Description                                                          |
| --- | ------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| 6.1 | **Slither static analysis**     | `packages/contracts-evm/`                        | Run `slither .` and fix findings                                     |
| 6.2 | **Mythril symbolic analysis**   | `packages/contracts-evm/`                        | Run `mythril analyze` and fix findings                               |
| 6.3 | **Complete WrappedBadge tests** | `packages/contracts-evm/test/WrappedBadge.t.sol` | Complete `test_lock_replay_protected` — test replay protection logic |

### 🟢 P3 — Social Recovery Hardening

| #   | Item                           | File(s)                                                | Description                                                                                              |
| --- | ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 7.1 | **Guardian threshold counter** | `packages/contracts-stellar/src/social_recovery.rs:59` | Implement the full counter logic: collect N attestations, check threshold, then rotate `Identity.pubkey` |

### 🟢 P3 — SDK Quality

| #   | Item                          | File(s)                                | Description                                                                    |
| --- | ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| 8.1 | **StrKey CRC16 verification** | `packages/sdk/src/utils/_strkey.ts:41` | Validate CRC16 checksum on Stellar addresses to catch typos before propagation |
| 8.2 | **EVM SDK client tests**      | `packages/sdk/src/evm/index.ts`        | Add unit tests for EVM client methods                                          |
| 8.3 | **ZKP SDK client tests**      | `packages/sdk/src/zkp/index.ts`        | Add unit tests for ZKP proving/verification wrappers                           |

---

## 📊 Summary by Package

| Area              | P0    | P1    | P2    | P3     | Total  |
| ----------------- | ----- | ----- | ----- | ------ | ------ |
| SDK               | 2     | —     | —     | 3      | **5**  |
| API Gateway       | 2     | —     | —     | —      | **2**  |
| Frontend          | —     | 5     | —     | —      | **5**  |
| Bridge Relayer    | 1     | —     | 1     | —      | **2**  |
| AI Fraud          | —     | —     | 2     | —      | **2**  |
| Stellar Contracts | —     | —     | 1     | 1      | **2**  |
| EVM Contracts     | —     | —     | —     | 2      | **2**  |
| ZK Circuits       | —     | —     | —     | 4      | **4**  |
| CI                | —     | —     | 4     | —      | **4**  |
| **Total**         | **5** | **5** | **8** | **10** | **28** |

---

## 🎯 Recommended Execution Order

| Sprint       | Focus                     | Items                       | Outcome                                                  |
| ------------ | ------------------------- | --------------------------- | -------------------------------------------------------- |
| **Sprint 1** | P0 — Core wiring          | 0.1 through 0.5             | End-to-end contract flow works (SDK → Soroban → Relayer) |
| **Sprint 2** | P1 — Frontend integration | 1.1 through 1.5             | Frontend works with real wallets and real SSE            |
| **Sprint 3** | P2 — Production readiness | 2.1, 2.2, 3.1, 3.2, 4.1–4.4 | Real AI features, real bridge, CI gates pass             |
| **Sprint 4** | P3 — Hardening & polish   | 5.1–8.3                     | ZK circuits verified, EVM audited, SDK tests complete    |

---

## 📝 Source Audit Trail

This backlog was derived from the following sources across the codebase:

### Roadmap (`docs/ROADMAP.md`)

- Phase 2 items 1–7 (listed at the top of each section above)

### Code-level TODOs (14 direct matches)

| File                                                 | Line      | Tag                |
| ---------------------------------------------------- | --------- | ------------------ |
| `packages/sdk/src/stellar/index.ts`                  | 73, 88-89 | TODO               |
| `apps/api-gateway/src/routes/identity.ts`            | 34        | TODO               |
| `apps/api-gateway/src/routes/credentials.ts`         | 15, 21    | TODO               |
| `apps/service-bridge-relayer/src/listeners/evm.ts`   | 60        | TODO               |
| `apps/service-bridge-relayer/src/horizon/client.ts`  | 23        | TODO               |
| `apps/frontend/src/hooks/useWallet.ts`               | 10        | TODO               |
| `apps/frontend/src/hooks/useBridge.ts`               | 17        | TODO               |
| `apps/frontend/src/components/BridgeMonitor.tsx`     | 25        | TODO               |
| `apps/frontend/src/lib/stellar.ts`                   | 37        | TODO               |
| `apps/service-ai-fraud/src/models/fraud_detector.py` | 35-37     | TODO               |
| `apps/service-ai-fraud/src/api.py`                   | 52        | TODO (Phase 2)     |
| `packages/contracts-stellar/src/social_recovery.rs`  | 59        | TODO               |
| `packages/sdk/src/utils/_strkey.ts`                  | 41        | TODO               |
| `.github/workflows/ci.yml`                           | 66        | TODO (via comment) |

### NOTES (non-TODO but indicating open work)

| File                                                | Line | Note                                                 |
| --------------------------------------------------- | ---- | ---------------------------------------------------- |
| `packages/contracts-stellar/src/identity.rs`        | 11   | `require_auth()` only on `Address`, not `BytesN<32>` |
| `packages/contracts-stellar/src/credentials.rs`     | 7    | `Address` vs `BytesN<32>` conversion limitation      |
| `packages/contracts-stellar/src/social_recovery.rs` | 8    | Ed25519 verification via `env.crypto()`              |
| `packages/contracts-evm/src/WrappedBadge.sol`       | 29   | Role grant ordering requirement                      |

---

> _Generated by the Phase 2 backlog audit on July 10, 2026._
