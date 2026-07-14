# 🛠️ Setup Guide

A canonical, step-by-step guide for running the entire platform on your machine.

---

## 0. Prerequisites

| Tool    | Version | Install                                                                     |
| ------- | ------- | --------------------------------------------------------------------------- |
| Node.js | ≥ 20.10 | [nvm](https://github.com/nvm-sh/nvm) / [fnm](https://github.com/Schniz/fnm) |
| pnpm    | ≥ 8     | `npm i -g pnpm`                                                             |
| Rust    | 1.79.0  | [rustup](https://rustup.rs)                                                 |
| Foundry | latest  | `curl -L https://foundry.paradigm.xyz \| bash && foundryup`                 |
| Circom  | 2.1.6   | see `scripts/install-circom.sh`                                             |
| Docker  | ≥ 24    | [docker.com](https://www.docker.com/)                                       |
| Python  | 3.11    | [python.org](https://python.org)                                            |

---

## 1. Clone & install

```bash
git clone https://github.com/your-org/Self-Sovereign-Identity.git
cd Self-Sovereign-Identity

cp .env.example .env       # then edit values

make bootstrap             # installs every toolchain
```

---

## 2. Build & test every subsystem

```bash
make build                 # builds all wasm + foundry + TS packages
make test                  # runs full test matrix
```

If you want to work on a single subsystem, use the workspace directly:

```bash
# Stellar Soroban contracts
make -C packages/contracts-stellar build
make -C packages/contracts-stellar test

# Solidity (Foundry)
cd packages/contracts-evm
forge build
forge test -vv

# ZK circuits
pnpm zk:compile
node packages/zk-circuits/test/credential.test.js

# SDK (TypeScript)
pnpm --filter @ssi/sdk build
pnpm --filter @ssi/sdk test

# Backend API
pnpm --filter @ssi/api-gateway dev

# Bridge relayer
pnpm --filter @ssi/service-bridge-relayer dev

# AI fraud (Python)
cd apps/service-ai-fraud
poetry install
poetry run uvicorn src.api:app --reload --port 8000

# IPFS service
pnpm --filter @ssi/service-ipfs dev

# Frontend
pnpm --filter @ssi/frontend dev
```

---

## 3. Local dev stack (docker-compose)

```bash
make dev
```

This launches Postgres, Redis, IPFS (Kubo), API gateway, bridge relayer, IPFS service, AI fraud service and the frontend. Visit:

- **Frontend** — <http://localhost:5173>
- **API gateway** (Swagger) — <http://localhost:8080/docs>
- **AI fraud** (OpenAPI) — <http://localhost:8000/docs>
- **IPFS gateway** — <http://localhost:8081/ipfs/<cid>**

---

## 4. Deploy to Stellar Testnet

```bash
# Configure in .env:
#   STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
#   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
#   STELLAR_DEPLOYER_SECRET=…your funded testnet secret…
make stellar && make stellar deploy
```

The CLI output will print the contract IDs – add them to `.env`:

```
STELLAR_IDENTITY_CONTRACT=CABC…
STELLAR_WRAPPED_BADGE_CONTRACT=CDEF…
```

---

## 5. Deploy to EVM testnet (Polygon Amoy)

```bash
# Configure in .env:
#   EVM_RPC_URL=https://rpc-amoy.polygon.technology
#   EVM_CHAIN_ID=80002
#   EVM_DEPLOYER_PRIVATE_KEY=0x…
cd packages/contracts-evm
forge script script/Deploy.s.sol --rpc-url $EVM_RPC_URL --broadcast
```

---

## 6. Generating ZK keys (Powers of Tau)

For real production use, run a Phase-2 trusted setup **once**:

```bash
cd packages/zk-circuits
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="First" -v
snarkjs powersoftau prepare phase2 pot17_0001.ptau pot17_final.ptau
snarkjs groth16 setup build/credential.r1cs pot17_final.ptau keys/credential_0000.zkey
snarkjs zkey contribute keys/credential_0000.zkey keys/credential_final.zkey --name="Second"
snarkjs zkey export verificationkey keys/credential_final.zkey keys/verification_key.json
```

> For dev only, the bundled `compile.sh` produces deterministic test keys.

---

## 7. Troubleshooting

| Symptom                                                        | Fix                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm install` fails                                           | delete `node_modules` and `pnpm-lock.yaml`, retry                    |
| `forge: command not found`                                     | re-run `foundryup` and `source ~/.bashrc`                            |
| Soroban build fails                                            | `rustup target add wasm32-unknown-unknown`                           |
| Circom errors                                                  | ensure `cargo` is installed before `./circom` build                  |
| Docker compose fails                                           | check `.env` for missing values, run `docker compose config`         |
| Bridge relayer logs `headBehind`                               | Horizon is on a fork — restart the relayer after the rpc catchup     |
| `apps/api-gateway` typecheck                                   | the SDK must be built first; run `pnpm --filter @ssi/sdk build`      |
| and then retry. CI runs `turbo run build` so the dependency is |
| wired up automatically.                                        |
| SDK build fails with "module not found: snarkjs" / viem        | the SDK lazy-imports these packages. If you see missing-peer errors, |
| ensure your tsconfig/module-resolution honours `"Bundler"`.    |
| `pnpm typecheck` complains about `.js` extensions              | the SDK barrel imports (`./foo.js`) are intentional under            |
| `moduleResolution: Bundler`. Do not strip the `.js` suffix.    |
| Foundry test reverts on role grant                             | deployer is no longer default-admin of `IdentitySBT`; grant the      |
| `ISSUER_ROLE` to the bridge via `script/Deploy.s.sol` after    |
| both contracts are deployed (this is now done automatically).  |

---

## 8. Useful commands cheat-sheet

```bash
# Open a Stellar contract's storage
soroban cli read-network --network testnet

# Inspect a Soroban tx
curl https://horizon-testnet.stellar.org/transactions/<hash>

# Pin a CID to IPFS
curl -X POST -F file=@./photo.jpg http://localhost:5001/api/v0/add

# Generate a ZK proof
cd packages/zk-circuits
snarkjs groth16 prove keys/credential_final.zkey build/credential.witness build/proof.json build/public.json
```
