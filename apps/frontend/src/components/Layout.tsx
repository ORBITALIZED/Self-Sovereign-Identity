import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { Shield, KeyRound, Globe2, BadgeCheck, Activity } from "lucide-react";
import WalletConnect from "./WalletConnect.js";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface-950 via-surface-900 to-brand-900/20">
      <header className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
        <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
          <Shield className="w-6 h-6 text-brand-500" />
          <span className="gradient-text">Self-Sovereign Identity</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "bg-brand-700/40 text-white" : "hover:bg-surface-700/60 text-slate-300"
                }`
              }
            >
              <span className="inline-flex items-center gap-2">
                <n.icon className="w-4 h-4" /> {n.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <WalletConnect />
      </header>

      <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">{children}</main>

      <footer className="px-6 py-4 text-xs text-slate-500 border-t border-surface-700 flex justify-between">
        <span>Built for the Urban &amp; Climate Action Track · Stellar + EVM + ZK</span>
        <span>v0.1.0</span>
      </footer>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: Shield },
  { to: "/identity/new", label: "New Identity", icon: KeyRound },
  { to: "/credentials", label: "Credentials", icon: BadgeCheck },
  { to: "/bridge", label: "Bridge", icon: Activity },
] as const;
