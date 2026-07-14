/**
 * Well-known values used across the SDK and the services. Centralised
 * so that consumers don't have to hard-code chain IDs, network
 * passphrases or asset-code prefixes in multiple places.
 */

/** Human-readable network identifiers. */
export type StellarNetwork = "public" | "testnet";

/** Stellar network passphrases — used when signing Soroban transactions. */
export const NETWORK_PHRASE: Record<StellarNetwork, string> = {
  public: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
};

/** Common EVM chain IDs the platform ships configurations for. */
export const EVM_CHAIN_ID = {
  ethereum: 1,
  sepolia: 11155111,
  polygon: 137,
  polygonAmoy: 80002,
  hardhat: 31337,
} as const;

/** Prefix the WrappedBadge contract uses for Stellar asset codes ("WID-…"). */
export const WRAPPED_ASSET_PREFIX = "WID";

/** Default timeout when polling the Soroban RPC for transaction confirmation. */
export const DEFAULT_TX_TIMEOUT_MS = 30_000;

/** Default HTTP timeout for fetch helpers used by the SDK and API gateway. */
export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
