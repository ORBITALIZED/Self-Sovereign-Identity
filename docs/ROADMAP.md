# 🗺️ Roadmap

A transparent view of where the project is heading.

---

## Phase 1 — Scaffold ✅  (this PR)

- [x] Poly-repo workspace
- [x] Soroban contract skeleton (identity, credentials, wrapped badge, social recovery)
- [x] Solidity (Foundry) skeleton (IdentitySBT, registry, wrapped badge)
- [x] Circom circuits (credential + age > 18)
- [x] SDK skeleton (Stellar + EVM + ZK helpers)
- [x] API gateway with OpenAPI
- [x] Bridge relayer (Horizon SSE + EVM WS)
- [x] AI fraud service skeleton
- [x] IPFS encryption service skeleton
- [x] Frontend dashboard (Vite + React + Tailwind)

---

## Phase 2 — Functional MVP

- [ ] Wire Soroban contract end-to-end → emit events consumed by relayer
- [ ] Implement Stellar Asset Contract code for wrapped badges (real `WID-…` assets)
- [ ] Implement AI fraud scorer (logistic regression baseline → gradient boosting)
- [ ] Real Circom circuit — `credential.circom` + `age_verification.circom` fully tested
- [ ] EVM contracts audited (slither + mythril)
- [ ] Wallet integration via [@stellar/freighter-api](https://github.com/StellarCN/freighter) + wagmi
- [ ] CI: GitHub Actions running Rust + Foundry + Vitest + pytest

---

## Phase 3 — Production

- [ ] Mainnet deployment scripts (Stellar public + Polygon)
- [ ] Pluggable IPFS pinning (Pinata, Filecoin, Arweave, local)
- [ ] Distributed key generation (DKG) for guardians
- [ ] Privacy-preserving biometrics (FHE / zkML)
- [ ] Mobile wallet (React Native or Flutter)
- [ ] DID Method specification (did:ssi)
- [ ] Selective disclosure JSON-LD credentials (W3C VC)

---

## Phase 4 — Ecosystem

- [ ] Issuer onboarding portal (universities, hospitals, employers)
- [ ] Government partnerships — birth certificate bridge
- [ ] Cross-border payment corridors via Stellar anchors
- [ ] DAO governance over fraud-scoring weights
- [ ] Public dashboard showing **verified-without-doxxing** identity attestations

---

## Long-term vision

> Make every human on Earth a one-click **cryptographic citizen** — anonymous by default, provable when needed, recoverable when lost.
