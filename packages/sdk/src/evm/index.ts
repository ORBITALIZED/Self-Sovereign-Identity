/**
 * EVM client — wraps viem and exposes the SSI contract surface.
 */

import { createPublicClient, http, type PublicClient, type WalletClient } from "viem";
import type { EvmAddress, EvmConfig } from "../types/index.js";
import { ChainConnectionError } from "../errors.js";

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

class RegistryContract {
  constructor(private p: SSIEvm) {}
  async isIssuer(addr: EvmAddress): Promise<boolean> {
    // abi.encode call + read
    void this.p;
    void addr;
    return false;
  }
}

class SBTContract {
  constructor(private p: SSIEvm) {}
  async balanceOf(owner: EvmAddress): Promise<bigint> {
    void this.p;
    void owner;
    return 0n;
  }
}

class BridgeContract {
  constructor(private p: SSIEvm) {}
  async lockAndNotify(_tokenId: bigint, _destChainId: number, _stellarHash: `0x${string}`) {
    void this.p;
    throw new Error("not implemented yet");
  }
}
