import { useState, useEffect } from "react";

export type WalletKind = "freighter" | "metamask" | null;

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<WalletKind>(null);

  useEffect(() => {
    // TODO: hydrate from @stellar/freighter-api + wagmi `getAccount`
    return () => {};
  }, []);

  async function connect(k: "freighter" | "metamask") {
    setKind(k);
    setAddress((k === "freighter" ? "G" : "0x") + "A".repeat(56).slice(0, 56));
  }

  function disconnect() {
    setAddress(null); setKind(null);
  }

  return {
    address,
    kind,
    isStellar: kind === "freighter",
    isEvm:     kind === "metamask",
    supported: true,
    connect,
    disconnect,
  };
}
