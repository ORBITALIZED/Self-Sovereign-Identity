import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./lib/wagmi.js";
import App from "./App.js";
import ErrorBoundary from "./components/ErrorBoundary.js";
import ScrollToTop from "./components/ScrollToTop.js";
import "./styles/globals.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ScrollToTop />
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
