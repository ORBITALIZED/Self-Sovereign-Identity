/**
 * EVM SDK wrapper — exposes a minimal Provider / Signer for wagmi / viem.
 */

import { createPublicClient, http, type PublicClient } from "viem";
import { polygonAmoy, sepolia, hardhat } from "viem/chains";

const CHAIN = Number(import.meta.env.VITE_EVM_CHAIN_ID ?? "80002");
const RPC = import.meta.env.VITE_EVM_RPC_URL ?? "https://rpc-amoy.polygon.technology";

export function publicClient(): PublicClient {
  return createPublicClient({
    chain: CHAIN === 80002 ? polygonAmoy : CHAIN === 11155111 ? sepolia : hardhat,
    transport: http(RPC),
  });
}
