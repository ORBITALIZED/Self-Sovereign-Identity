/**
 * EVM SDK wrapper — exposes a minimal Provider / Signer for wagmi / viem.
 * Also creates read-only contract instances for the SSI contracts.
 */

import {
  createPublicClient,
  http,
  getContract,
  type PublicClient,
  type GetContractReturnType,
} from "viem";
import { polygonAmoy, sepolia, hardhat } from "viem/chains";

const CHAIN = Number(import.meta.env.VITE_EVM_CHAIN_ID ?? "80002");
const RPC = import.meta.env.VITE_EVM_RPC_URL ?? "https://rpc-amoy.polygon.technology";

const REGISTRY_ADDR = (import.meta.env.VITE_EVM_REGISTRY_CONTRACT ?? "0x") as `0x${string}`;
const SBT_ADDR = (import.meta.env.VITE_EVM_SBT_CONTRACT ?? "0x") as `0x${string}`;
const BRIDGE_ADDR = (import.meta.env.VITE_EVM_BRIDGE_CONTRACT ?? "0x") as `0x${string}`;

const REGISTRY_ABI = [
  "function isIssuer(address who) view returns (bool)",
  "function isSchema(bytes32 hash) view returns (bool)",
] as const;

const SBT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
] as const;

const BRIDGE_ABI = [
  "function processedLocks(bytes32) view returns (bool)",
  "function lockAndNotify(uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
  "event BadgeLocked(address indexed holder, bytes32 indexed schemaHash, uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
] as const;

export function publicClient(): PublicClient {
  return createPublicClient({
    chain: CHAIN === 80002 ? polygonAmoy : CHAIN === 11155111 ? sepolia : hardhat,
    transport: http(RPC),
  });
}

/** Read-only IdentityRegistry contract instance. */
export function registryContract(
  client?: PublicClient,
): GetContractReturnType<typeof REGISTRY_ABI, PublicClient> {
  return getContract({
    address: REGISTRY_ADDR,
    abi: REGISTRY_ABI,
    client: client ?? publicClient(),
  }) as GetContractReturnType<typeof REGISTRY_ABI, PublicClient>;
}

/** Read-only IdentitySBT contract instance. */
export function sbtContract(
  client?: PublicClient,
): GetContractReturnType<typeof SBT_ABI, PublicClient> {
  return getContract({
    address: SBT_ADDR,
    abi: SBT_ABI,
    client: client ?? publicClient(),
  }) as GetContractReturnType<typeof SBT_ABI, PublicClient>;
}

/** Read-only WrappedBadge bridge contract instance. */
export function bridgeContract(
  client?: PublicClient,
): GetContractReturnType<typeof BRIDGE_ABI, PublicClient> {
  return getContract({
    address: BRIDGE_ADDR,
    abi: BRIDGE_ABI,
    client: client ?? publicClient(),
  }) as GetContractReturnType<typeof BRIDGE_ABI, PublicClient>;
}
