/**
 * wagmi configuration — single source of truth for EVM wallet connections.
 *
 * Uses the `injected` connector (MetaMask, Rainbow, Trust Wallet, etc.)
 * and viem transports for the configured chain.
 */

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { polygonAmoy, sepolia, hardhat } from "viem/chains";

const CHAIN_ID = Number(import.meta.env.VITE_EVM_CHAIN_ID ?? "80002");

/** The chain object matching the configured chain ID. */
export const targetChain =
  CHAIN_ID === 80002 ? polygonAmoy : CHAIN_ID === 11155111 ? sepolia : hardhat;

export const wagmiConfig = createConfig({
  chains: [polygonAmoy, sepolia, hardhat] as const,
  connectors: [injected()],
  transports: {
    [polygonAmoy.id]: http(),
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
});
