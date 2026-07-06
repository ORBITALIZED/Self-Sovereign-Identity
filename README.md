# 🆔 Self-Sovereign Identity (SSI) Platform

> **A blockchain-based identity platform where users own and control their personal identity instead of governments or corporations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue)](https://stellar.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-yellow)](https://soliditylang.org)
[![ZK](https://img.shields.io/badge/ZK-Circom-purple)](https://iden3.io/circom)

This is a **poly-repo-style monorepo** that demonstrates a complete SSI platform built primarily on **Stellar (Soroban)** with companion EVM contracts, zero-knowledge circuits, off-chain services, and a developer SDK.

---

## 🌍 The Problem

> Over a billion people worldwide lack reliable legal identity, making it difficult to access banking, healthcare, education, voting, or employment.

This platform gives every human a **cryptographically owned, privacy-preserving identity** they can carry across borders — without depending on any single government, corporation, or intermediary.

---

## ✨ Features

| Feature | Status | Implemented In |
|---|---|---|
| Self-owned digital identity wallet | ✅ Scaffold | `apps/frontend`, `packages/sdk` |
| Biometric verification (off-chain) | ✅ Scaffold | `apps/service-ipfs` |
| Zero-knowledge proof authentication | ✅ Scaffold | `packages/zk-circuits`, `packages/sdk` |
| Educational & employment certificates | ✅ Scaffold | `packages/contracts-stellar` |
| Medical identity integration | ✅ Scaffold | `apps/api-gateway` |
| Cross-border verification | ✅ Scaffold | `apps/service-bridge-relayer` |
| Recovery through trusted guardians | ✅ Scaffold | `packages/contracts-stellar/src/social_recovery.rs` |
| NFT-based identity badges | ✅ Scaffold | `packages/contracts-evm/src/IdentitySBT.sol`, `packages/contracts-stellar/src/wrapped_badge.rs` |
| Privacy controls | ✅ Scaffold | `packages/zk-circuits` |
| AI-powered fraud detection | ✅ Scaffold | `apps/service-ai-fraud` |

---

## 🏗️ Repository Layout (Poly-Repo Style)

```
Self-Sovereign-Identity/
├── packages/                     # Shared libraries / contracts
│   ├── contracts-stellar/        # Soroban Rust contracts (Stellar native)
│   ├── contracts-evm/            # Solidity contracts (OpenZeppelin/Foundry)
│   ├── zk-circuits/              # Circom circuits + proving scripts
│   └── sdk/                      # TypeScript SDK consumed by apps
├── apps/                         # Runnable services
│   ├── api-gateway/              # Fastify REST/GraphQL gateway
│   ├── service-bridge-relayer/   # Cross-chain wrapped-badge relayer
│   ├── service-ai-fraud/         # Python fraud detection (FastAPI)
│   ├── service-ipfs/             # Encrypted biometric/credential pinning
│   └── frontend/                 # React + Vite + Tailwind dashboard
├── docs/                         # Architecture, setup, contributing
├── scripts/                      # Dev / deploy / bootstrap scripts
├── docker-compose.yml            # One-command local stack
├── Makefile                      # Macro commands (build, test, deploy)
└── turbo.json                    # Turborepo pipeline
```

Every subfolder is **independently buildable** (has its own `package.json` / `Cargo.toml` / `foundry.toml`) — exactly like separate git repos, but coordinated by the root workspace.

---

## 🚀 Quick Start

```bash
git clone https://github.com/your-org/Self-Sovereign-Identity.git
cd Self-Sovereign-Identity

# 1. Install JS workspace deps
pnpm install            # or: npm install

# 2. Bootstrap native toolchains (Rust, Foundry, Circom)
make bootstrap

# 3. Spin up the local stack (Postgres, Redis, IPFS, all services)
make dev

# 4. Build everything
make build
```

Open [http://localhost:5173](http://localhost:5173) for the **frontend dashboard**.
Open [http://localhost:8080/docs](http://localhost:8080/docs) for the **API gateway** (Swagger).

---

## 🛠️ Tech Stack

- **Stellar / Soroban** — primary chain for the identity registry and wrapped badges
- **Solidity / Foundry** — ERC-721 + Soulbound Token (SBT) identity badges on EVM chains
- **Circom / snarkjs** — Zero-knowledge proofs (age > 18, credential ownership, etc.)
- **IPFS / Helia** — Encrypted off-chain storage for biometrics and certificates
- **Fastify** — HTTP API gateway
- **React / Vite / Tailwind** — Frontend dashboard
- **Python / FastAPI / scikit-learn** — AI fraud-detection microservice
- **Turborepo + pnpm workspaces** — Build orchestration

---

## 🔁 Architecture at a Glance

```
                          ┌────────────────────┐
                          │   React Frontend   │
                          │  (Vite + Tailwind) │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │   API Gateway      │
                          │  (Fastify + JWT)   │
                          └─┬───┬───┬───┬──────┘
                            │   │   │   │
       ┌────────────────────┘   │   │   └─────────────────────┐
       │                        │   │                         │
┌──────▼──────┐      ┌──────────▼┐ ┌─▼──────────┐   ┌────────▼────────┐
│  AI Fraud   │      │  IPFS Svc  │ │ Bridge     │   │   ZK Prover     │
│  (Python)   │      │  (Helia)   │ │ Relayer    │   │   (snarkjs)     │
└─────────────┘      └────────────┘ │ (Horizon+  │   └─────────────────┘
                                    │  EVM list.) │
                                    └──────┬──────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
┌───────▼────────┐                ┌────────▼─────────┐              ┌──────────▼─────────┐
│  Stellar       │                │  EVM (Polygon/   │              │  EVM (Ethereum/    │
│  Soroban       │◄───wrapped────│  Arbitrum)       │◄──wrapped────│  Optimism)         │
│  contracts     │     tokens     │  ERC-721 SBTs    │     tokens   │  ERC-721 SBTs      │
└────────────────┘                └──────────────────┘              └────────────────────┘
```

The **Bridge Relayer** is the heart of the cross-chain identity verification: when a Soulbound identity badge is issued on an EVM chain (e.g. a medical degree from a Colombian university on Polygon), the relayer detects the EVM event, runs fraud detection, and mints a corresponding **Wrapped Identity Badge** on Stellar — enabling the bearer to access Stellar-native services (low-fee remittances, DeFi, voting) using proof of their cross-chain identity.

---

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full system design
- [`docs/SETUP.md`](docs/SETUP.md) — detailed setup guide
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — how to contribute
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's next

---

## 🤝 Contributing

PRs welcome! Read [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) first.

---

## 📜 License

MIT © 2026 — See [LICENSE](LICENSE).
