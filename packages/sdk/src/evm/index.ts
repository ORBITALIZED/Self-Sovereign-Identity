/**
 * EVM client — wraps viem and exposes the SSI contract surface.
 */

import { createPublicClient, http, type PublicClient, type WalletClient } from "viem";
import type { EvmAddress, EvmConfig } from "../types/index.js";
import { ChainConnectionError } from "../errors.js";

/**
 * EVM client — wraps viem and exposes the SSI contract surface.
 *
 * Initialise it once with the chain configuration; the resulting public
 * client can be used directly or accessed through the `registry`, `sbt`
 * and `bridge` sub-clients. A wallet client can be attached later via
 * {@link SSIEvm.setWallet} for write-path call building.
 */
export class SSIEvm {
  public readonly publicClient: PublicClient;

  constructor(public readonly config: EvmConfig) {
    if (!config.rpcUrl) throw new ChainConnectionError("evm", config.rpcUrl);
    this.publicClient = createPublicClient({ transport: http(config.rpcUrl) });
  }

  registry = new RegistryContract(this);
  sbt = new SBTContract(this);
  bridge = new BridgeContract(this);

  /** Attach a wallet client (e.g. created from a wagmi connector). */
  setWallet(wallet: WalletClient) {
    void wallet; /* for later use */
  }
}

/** Sub-client for read-only queries against the `IdentityRegistry` contract. */
class RegistryContract {
  constructor(private p: SSIEvm, private abi = [
    "function isIssuer(address who) view returns (bool)",
    "function isSchema(bytes32 hash) view returns (bool)",
  ]) {}

  /** True if the given address is currently an active registered issuer. */
  async isIssuer(addr: EvmAddress): Promise<boolean> {
    const data = await this.p.publicClient.readContract({
      address: this.p.config.contracts.registry,
      abi: this.abi,
      functionName: "isIssuer",
      args: [addr],
    });
    return data as boolean;
  }

  /** True if the given schema hash is an active registered schema. */
  async isSchema(hash: `0x${string}`): Promise<boolean> {
    const data = await this.p.publicClient.readContract({
      address: this.p.config.contracts.registry,
      abi: this.abi,
      functionName: "isSchema",
      args: [hash],
    });
    return data as boolean;
  }
}

/** Sub-client for read-only queries against the `IdentitySBT` contract. */
class SBTContract {
  constructor(private p: SSIEvm, private abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
  ]) {}

  /** Number of SBTs the owner currently holds. */
  async balanceOf(owner: EvmAddress): Promise<bigint> {
    const data = await this.p.publicClient.readContract({
      address: this.p.config.contracts.sbt,
      abi: this.abi,
      functionName: "balanceOf",
      args: [owner],
    });
    return data as bigint;
  }

  /** The current owner of the given token ID. */
  async ownerOf(tokenId: bigint): Promise<EvmAddress> {
    const data = await this.p.publicClient.readContract({
      address: this.p.config.contracts.sbt,
      abi: this.abi,
      functionName: "ownerOf",
      args: [tokenId],
    });
    return data as EvmAddress;
  }
}

/** Sub-client for write-path calls against the `WrappedBadge` bridge contract. */
class BridgeContract {
  constructor(private p: SSIEvm, private abi = [
    "function lockAndNotify(uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)",
    "function processedLocks(bytes32) view returns (bool)",
  ]) {}

  /** Burns an SBT and emits a `BadgeLocked` event picked up by the relayer. */
  async lockAndNotify(tokenId: bigint, destChainId: number, stellarHash: `0x${string}`) {
    // Requires a wallet client attached via setWallet() for signing.
    if (!this.p.config.rpcUrl) throw new Error("EVM RPC URL not configured");
    const { createWalletClient, custom } = await import("viem");
    const wallet = createWalletClient({ transport: custom((window as any).ethereum) });
    const [account] = await wallet.getAddresses();
    const { request } = await wallet.simulateContract({
      address: this.p.config.contracts.bridge,
      abi: this.abi,
      functionName: "lockAndNotify",
      args: [tokenId, destChainId, stellarHash],
      account,
    });
    return await wallet.writeContract(request);
  }

  /** Check if a lock hash has already been processed (replay guard). */
  async isProcessed(lockHash: `0x${string}`): Promise<boolean> {
    const data = await this.p.publicClient.readContract({
      address: this.p.config.contracts.bridge,
      abi: this.abi,
      functionName: "processedLocks",
      args: [lockHash],
    });
    return data as boolean;
  }
}
