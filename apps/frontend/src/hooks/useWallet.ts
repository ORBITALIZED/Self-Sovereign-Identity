import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useAccountEffect } from "wagmi";
import { getAddress, isConnected, requestAccess, getNetwork } from "@stellar/freighter-api";

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

export type WalletKind = "freighter" | "metamask" | null;

export function useWallet() {
  // ── wagmi hooks (EVM / MetaMask) ──────────────────────────────────────
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { connect: wagmiConnectAsync, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // ── local state (Freighter + wallet tracking) ────────────────────────
  const [stellarAddress, setStellarAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<WalletKind>(null);
  const [supported, setSupported] = useState(false);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);

  // Refs to avoid stale closures in useAccountEffect callbacks.
  const kindRef = useRef(kind);
  kindRef.current = kind;

  // ── derive the active address ─────────────────────────────────────────
  const address = kind === "metamask" ? (evmAddress ?? null) : stellarAddress;

  // ── detect available wallets on mount ─────────────────────────────────
  useEffect(() => {
    const detect = async () => {
      let hasFreighter = false;
      try {
        const conn = await isConnected();
        hasFreighter = conn.isConnected;
      } catch {
        hasFreighter = false;
      }

      const hasEthereum = typeof window.ethereum?.request === "function";
      setSupported(hasFreighter || hasEthereum);

      // Auto-hydrate Freighter if already authorised
      if (hasFreighter) {
        try {
          const addr = await getAddress();
          if (addr.address) {
            setStellarAddress(addr.address);
            setKind("freighter");
            const net = await getNetwork();
            setNetworkPassphrase(net.networkPassphrase ?? null);
          }
        } catch {
          // Not yet authorised — user needs to click connect
        }
      }
    };

    void detect();
  }, []);

  // ── auto-hydrate EVM if wagmi already has a connected account ─────────
  useEffect(() => {
    if (evmConnected && evmAddress && kind === null) {
      setKind("metamask");
      setNetworkPassphrase(null); // EVM chains use chainId, not passphrase
    }
  }, [evmConnected, evmAddress, kind]);

  // ── react to MetaMask disconnects ─────────────────────────────────────
  // Use kindRef to avoid a stale closure over `kind`.
  useAccountEffect({
    onDisconnect() {
      if (kindRef.current === "metamask") {
        setKind(null);
      }
    },
  });

  // ── connect handler ──────────────────────────────────────────────────
  const connect = useCallback(
    async (k: "freighter" | "metamask") => {
      try {
        if (k === "freighter") {
          await requestAccess();
          const addr = await getAddress();
          if (!addr.address) throw new Error("Freighter returned no address");
          setStellarAddress(addr.address);
          setKind("freighter");
          const net = await getNetwork();
          setNetworkPassphrase(net.networkPassphrase ?? null);
        } else {
          // Use the MetaMask-compatible injected connector
          const injectedConnector = connectors.find((c) => c.type === "injected");
          if (!injectedConnector) throw new Error("No injected connector available");
          // Wagmi's connectAsync resolves after the user approves the connection.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (wagmiConnectAsync({ connector: injectedConnector }) as any);
          setKind("metamask");
          setNetworkPassphrase(null);
        }
      } catch (e) {
        console.error("Wallet connection failed:", e);
      }
    },
    [connectors, wagmiConnectAsync],
  );

  // ── disconnect handler ────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (kind === "metamask") {
      wagmiDisconnect();
    }
    setStellarAddress(null);
    setKind(null);
    setNetworkPassphrase(null);
  }, [kind, wagmiDisconnect]);

  return {
    address,
    kind,
    isStellar: kind === "freighter",
    isEvm: kind === "metamask",
    supported,
    networkPassphrase,
    connect,
    disconnect,
  } as const;
}
