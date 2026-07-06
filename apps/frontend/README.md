# 🖥️ @ssi/frontend

The Self-Sovereign Identity **user-facing dashboard**. Built with:

* **React 18** + **Vite** for fast HMR
* **Tailwind CSS** for a polished UI
* **wagmi + viem** for EVM wallets (MetaMask / Rainbow / WalletConnect)
* **@stellar/freighter-api** for the Stellar wallet (Freighter / xBull / Ralpher)
* **@tanstack/react-query** for optimistic data fetching

## Pages

| Route | Component | Features |
|---|---|---|
| `/` | `Dashboard.tsx`          | At-a-glance identity, last 5 credentials, recent bridge events |
| `/identity/new` | `CreateIdentity.tsx` | Create a new Soroban identity |
| `/identity/:pubkey` | `IdentityCard.tsx` | Inspect identity, rotate biometric, manage guardians |
| `/credentials` | `Credentials.tsx` | Browse credentials presented to the app |
| `/bridge` | `BridgeMonitor.tsx`        | Live-stream of wrapped-badge flows (Horizon SSE) |

## Run

```bash
pnpm --filter @ssi/frontend dev
docker compose up frontend
```

Open <http://localhost:5173>.

## Notable UI primitives

```
src/components/ui/Button.tsx    — primary / secondary / ghost variants
src/components/ui/Card.tsx      — surface with subtle border + elevation
src/components/ui/Modal.tsx     — accessible focus-trap modal
```

## Env

```
VITE_API_URL=http://localhost:8080
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_EVM_CHAIN_ID=80002
```
