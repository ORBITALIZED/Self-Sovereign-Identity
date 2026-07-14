import { useState, useEffect, useCallback } from "react";

export type WalletKind = "freighter" | "metamask" | null;

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<WalletKind>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Detect available wallet providers
    const hasFreighter = typeof window !== "undefined" && !!(window as any).freighterApi;
    const hasEthereum = typeof window !== "undefined" && !!(window as any).ethereum;
    setSupported(hasFreighter || hasEthereum);
  }, []);

  const connect = useCallback(async (k: "freighter" | "metamask") => {
    try {
      if (k === "freighter") {
        const api = (window as any).freighterApi;
        if (!api) throw new Error("Freighter not installed");
        const pubKey = await api.getPublicKey();
        setAddress(pubKey);
        setKind("freighter");
      } else {
        const eth = (window as any).ethereum;
        if (!eth) throw new Error("No Ethereum wallet found");
        const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
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
  }, []);

  return {
    address,
    kind,
    isStellar: kind === "freighter",
    isEvm: kind === "metamask",
    supported,
    connect,
    disconnect,
  };
}
