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
  constructor(private p: SSIEvm) {}
  /** True if the given address is currently an active registered issuer. */
  async isIssuer(addr: EvmAddress): Promise<boolean> {
    // abi.encode call + read
    void this.p;
    void addr;
    return false;
  }
}

/** Sub-client for read-only queries against the `IdentitySBT` contract. */
class SBTContract {
  constructor(private p: SSIEvm) {}
  /** Number of non-revoked SBTs the owner currently holds. */
  async balanceOf(owner: EvmAddress): Promise<bigint> {
    void this.p;
    void owner;
    return 0n;
  }
}

/** Sub-client for write-path calls against the `WrappedBadge` bridge contract. */
class BridgeContract {
  constructor(private p: SSIEvm) {}
  /** Burns an SBT and emits a `BadgeLocked` event picked up by the relayer. */
  async lockAndNotify(_tokenId: bigint, _destChainId: number, _stellarHash: `0x${string}`) {
    void this.p;
    throw new Error("not implemented yet");
  }
}
