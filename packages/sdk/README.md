# 📦 @ssi/sdk

The canonical **TypeScript SDK** for building on the Self-Sovereign Identity platform. Other apps in this monorepo depend on this package instead of duplicating Stellar / EVM / ZK integration code.

## Structure

```
packages/sdk/
├── src/
│   ├── index.ts                # public re-exports
│   ├── stellar/
│   │   ├── index.ts            # Soroban + Horizon client
│   │   ├── IdentityRegistry.ts
│   │   ├── WrappedBadge.ts
│   │   └── Credentials.ts
│   ├── evm/
│   │   ├── index.ts            # ERC-4337 / viem wrappers
│   │   ├── IdentitySBT.ts
│   │   ├── IdentityRegistry.ts
│   │   └── WrappedBadge.ts
│   ├── zkp/
│   │   ├── index.ts            # snarkjs wrapper
│   │   ├── prover.ts
│   │   └── verifier.ts
│   ├── types/
│   │   └── index.ts
│   ├── errors.ts
│   └── utils/
│       ├── index.ts
│       ├── encoding.ts         # base32 / base64url / hash helpers
│       └── events.ts           # typed event interfaces
└── tests/                      # Vitest
```

## Quick example

```ts
import { SSIStellar, SSIEvm, SSIZkp } from "@ssi/sdk";

const stellar = new SSIStellar({
  horizonUrl:    "https://horizon-testnet.stellar.org",
  rpcUrl:        "https://soroban-testnet.stellar.org",
  networkPass:   "Test SDF Network ; September 2015",
  identityCid:   process.env.STELLAR_IDENTITY_CONTRACT!,
  wrappedBadgeCid: process.env.STELLAR_WRAPPED_BADGE_CONTRACT!,
});
const evm = new SSIEvm({
  rpcUrl:   process.env.EVM_RPC_URL!,
  chainId:  Number(process.env.EVM_CHAIN_ID),
  registry: process.env.EVM_REGISTRY_CONTRACT!,
  sbt:      process.env.EVM_BADGE_CONTRACT!,
  bridge:   process.env.EVM_BRIDGE_CONTRACT!,
});
const zkp = new SSIZkp({ wasm: "…", zkey: "…" });

// Issue a Soroban identity
await stellar.identity.create({ pubkey, biometricCommitment, cid, guardians });
```

## Install

```bash
pnpm add @ssi/sdk
```
