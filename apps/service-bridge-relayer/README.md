# 🌉 @ssi/service-bridge-relayer

Long-running Node service that watches **two chains in parallel** and keeps the wrapped-badge state consistent:

| Source | Listener | Action |
|---|---|---|
| **Stellar Horizon** (SSE) | `listeners/stellar.ts` | emits `IdentityCreated`, `CredentialIssued`, `BadgeWrapped` into a Redis stream consumed by the API gateway's `/bridge/wrapped` SSE route |
| **EVM JSON-RPC** | `listeners/evm.ts` | watches `BadgeLocked` on the `WrappedBadge` contract → calls the AI fraud service → calls the Soroban `WrappedBadge.wrap_badge` |

The relayer is **idempotent**: every lock or wrap is keyed by a unique hash so duplicate events never cause double minting.

## Run

```bash
pnpm --filter @ssi/service-bridge-relayer dev     # tsx watch
docker compose up service-bridge-relayer
```

## ENV

| Variable | Purpose |
|---|---|
| `STELLAR_HORIZON_URL` | Horizon endpoint (testnet by default) |
| `STELLAR_SOROBAN_RPC_URL` | Required for `wrap_badge` invocations |
| `EVM_RPC_URL` | EVM RPC (Polygon Amoy in prod) |
| `EVM_BRIDGE_CONTRACT` | WillListen to |
| `STELLAR_WRAPPED_BADGE_CONTRACT` | Will mint on |
| `DATABASE_URL` | Postgres for state (last processed block/ledger) |
| `RELAYER_FEE_BPS` | Optional fee to deduct from wrapped assets |
