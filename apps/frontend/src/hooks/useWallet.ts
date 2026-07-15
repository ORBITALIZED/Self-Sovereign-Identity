import { useState, useEffect, useCallback } from "react";
import { getAddress, isConnected, requestAccess, getNetwork } from "@stellar/freighter-api";

export type WalletKind = "freighter" | "metamask" | null;

/** Minimal interface for an EIP-1193 Ethereum provider (MetaMask, etc.). */
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<WalletKind>(null);
  const [supported, setSupported] = useState(false);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);

  useEffect(() => {
    // Detect available wallet providers
    const detectWallets = async () => {
      let hasFreighter = false;
      try {
        const conn = await isConnected();
        hasFreighter = conn.isConnected;
      } catch {
        hasFreighter = false;
      }
      const hasEthereum = typeof window.ethereum?.request === "function";
      setSupported(hasFreighter || hasEthereum);

      // If Freighter is already connected, auto-hydrate the address
      if (hasFreighter) {
        try {
          const addr = await getAddress();
          if (addr.address) {
            setAddress(addr.address);
            setKind("freighter");
            const net = await getNetwork();
            setNetworkPassphrase(net.networkPassphrase ?? null);
          }
        } catch {
          // Not yet authorised — user needs to click connect
        }
      }
    };

    void detectWallets();
  }, []);

  const connect = useCallback(async (k: "freighter" | "metamask") => {
    try {
      if (k === "freighter") {
        // Request access via Freighter's native permission flow
        await requestAccess();
        const addr = await getAddress();
        if (!addr.address) throw new Error("Freighter returned no address");
        setAddress(addr.address);
        setKind("freighter");
        const net = await getNetwork();
        setNetworkPassphrase(net.networkPassphrase ?? null);
      } else {
        const eth: EthereumProvider | undefined = window.ethereum;
        if (!eth) throw new Error("No Ethereum wallet found");
        const accounts = (await eth.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setKind("metamask");
        }
      }
    } catch (e) {
      console.error("Wallet connection failed:", e);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setKind(null);
    setNetworkPassphrase(null);
  }, []);

  return {
    address,
    kind,
    isStellar: kind === "freighter",
    isEvm: kind === "metamask",
    supported,
    networkPassphrase,
    connect,
    disconnect,
  };
}
