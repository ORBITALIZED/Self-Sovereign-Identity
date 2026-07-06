# 📦 @ssi/contracts-evm

Solidity smart contracts (Foundry-based) for issuing Identity Soulbound Tokens (SBTs) on EVM chains. These tokens are the **source side** of the cross-chain wrapped-badge flow that lands on Stellar.

| Contract | Purpose |
|---|---|
| `IdentitySBT.sol` | ERC-721 with `_update` overridden to make it **non-transferable** (soulbound) |
| `IdentityRegistry.sol` | Maps `(issuer, schema)` → status; centralised registry of authorised issuers |
| `WrappedBadge.sol` | Bridge contract that burns an SBT and emits `Lock` for the Stellar relayer |
| `interfaces/IIdentity.sol` | Common interface implemented by every contract |

## Layout

```
packages/contracts-evm/
├── foundry.toml
├── remappings.txt
├── script/                  # Forge deployment scripts
├── src/
│   ├── IdentitySBT.sol
│   ├── IdentityRegistry.sol
│   ├── WrappedBadge.sol
│   └── interfaces/IIdentity.sol
└── test/                    # Forge unit tests
```

## Build / test

```bash
forge build
forge test -vv

forge script script/Deploy.s.sol \
  --rpc-url $EVM_RPC_URL \
  --private-key $EVM_DEPLOYER_PRIVATE_KEY \
  --broadcast
```

## Notes

* Uses **OpenZeppelin v5** for ERC-721 base.
* `WrappedBadge` is **the only contract that can burn SBTs** — by design.
* The bridge relayer (`apps/service-bridge-relayer`) listens to the
  `BadgeLocked(subject, cid, sourceChainId, sourceTxHash)` event.
