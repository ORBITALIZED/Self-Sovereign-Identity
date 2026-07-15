import { useState } from "react";
import { useWallet } from "../hooks/useWallet.js";
import { Button } from "./ui/Button.js";
import { Wallet, ExternalLink } from "lucide-react";

export default function WalletConnect({ embedded = false }: { embedded?: boolean }) {
  const { address, isStellar, connect, disconnect, supported } = useWallet();
  const [open, setOpen] = useState(false);

  if (embedded) {
    return (
      <div className="surface-card p-6 max-w-md mx-auto">
        <h2 className="text-lg font-semibold mb-2">Connect a wallet</h2>
        <p className="text-sm text-slate-400 mb-6">
          Choose a Stellar wallet (Freighter, xBull) or an EVM wallet (MetaMask, Rainbow).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="surface-card p-3 text-center space-y-2 cursor-pointer hover:bg-surface-600 transition-colors"
            onClick={() => connect("freighter")}
          >
            <span className="text-brand-500 font-medium">Freighter</span>
            <p className="text-xs text-slate-400">Stellar · Soroban</p>
            <span className="text-xs text-emerald-400">Testnet</span>
          </div>
          <div
            className="surface-card p-3 text-center space-y-2 cursor-pointer hover:bg-surface-600 transition-colors"
            onClick={() => connect("metamask")}
          >
            <span className="text-yellow-400 font-medium">MetaMask</span>
            <p className="text-xs text-slate-400">EVM · Polygon</p>
            <span className="text-xs text-emerald-400">Amoy Testnet</span>
          </div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <Button onClick={() => setOpen(true)} icon={<Wallet className="w-4 h-4" />}>
        Connect
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="surface-card px-4 py-2 text-sm flex items-center gap-2"
      >
        <span className={isStellar ? "pulse-dot" : "pulse-dot bg-yellow-400"} />
        {address.slice(0, 4)}…{address.slice(-4)}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 surface-card p-3 text-sm">
          <div className="text-slate-400 text-xs uppercase mb-1">Wallet</div>
          <div className="mb-3 break-all">{address}</div>
          <button
            onClick={disconnect}
            className="w-full text-left text-red-400 hover:text-red-300 inline-flex items-center gap-2"
          >
            <ExternalLink className="w-3 h-3" /> Disconnect
          </button>
          <div className="text-xs text-slate-500 mt-2">
            {isStellar ? "Stellar Testnet" : "Polygon Amoy"}
            {supported ? " · Multi-chain ready" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
