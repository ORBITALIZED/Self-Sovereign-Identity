import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.js";
import ErrorBoundary from "./components/ErrorBoundary.js";
import ScrollToTop from "./components/ScrollToTop.js";
import Dashboard from "./pages/Dashboard.js";
import CreateIdentity from "./pages/CreateIdentity.js";
import Credentials from "./pages/Credentials.js";
import BridgeMonitor from "./pages/BridgeMonitor.js";
import WalletConnect from "./components/WalletConnect.js";

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/identity/new" element={<CreateIdentity />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/bridge" element={<BridgeMonitor />} />
          <Route path="/wallet" element={<WalletConnect embedded />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}
