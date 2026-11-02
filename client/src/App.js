import React, { useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { getContractsForChain, hasValidAddress } from "./config/contracts";

import Marketplace from "./pages/Marketplace";
import VaultDashboard from "./pages/VaultDashboard";
import Trade from "./pages/Trade";
import Stake from "./pages/Stake";
import Governance from "./pages/Governance";
import Admin from "./pages/Admin";
import WalletModal from "./components/WalletModal";
import PriceTicker from "./components/PriceTicker";
import Oracle from "./pages/Oracle";
import PropPriceOracle from "./pages/PropPriceOracle";
import PropertyDetail from "./pages/PropertyDetail";
import SecurityLab from "./pages/SecurityLab";

// Suppress Web3Modal ENS resolution errors that cause React error overlay
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes("ResolverNotFound")) {
    event.preventDefault(); // Prevent the error overlay
  }
});

const NAV_ITEMS = [
  { to: "/", label: "🏠 Marketplace" },
  { to: "/vault", label: "🏦 Vault" },
  { to: "/trade", label: "📈 Trade" },
  { to: "/stake", label: "🌾 Yield Farm" },
  { to: "/oracle", label: "🔮 Oracle" },
  { to: "/prop-price", label: "💱 PROP Price" },
  { to: "/security-lab", label: "🛡️ Security Lab" },
  { to: "/governance", label: "🗳️ Governance" },
  { to: "/admin", label: "⚙️ Admin" },
];

function AppShell() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [marketRefreshKey, setMarketRefreshKey] = useState(0);
  const { account, chainId } = useWallet();

  const contracts = useMemo(() => getContractsForChain(chainId), [chainId]);
  const landRegistryAddress = contracts?.landRegistry || "";
  const propertyDisputeAddress = contracts?.propertyDispute || "";
  const addressesReady =
    hasValidAddress(landRegistryAddress) &&
    hasValidAddress(propertyDisputeAddress);

  const pushSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3500);
  };



  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <h1>PropChain</h1>
            <p>Tokenized Real Estate Labs</p>
          </div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="content">
          <header className="topbar">
            <div>
              <h2>PropChain</h2>
              <p>Decentralized Real Estate Investment &amp; Yield Platform</p>
            </div>

            <div className="topbar-actions">
              <PriceTicker />
              <div className="wallet-box">
                <WalletModal />
              </div>
            </div>
          </header>

          {!addressesReady && (
            <div className="alert alert-warning">
              Contract addresses are not fully configured for this chain. Update
              client/src/config/contracts.js after deployments.
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <Routes>
            <Route
              path="/"
              element={
                <Marketplace
                  landRegistryAddress={landRegistryAddress}
                  refreshKey={marketRefreshKey}
                  propertyTokenFactoryAddress={contracts?.propertyTokenFactory}
                  propertyTokens={contracts?.propertyTokens}
                />
              }
            />
            <Route path="/vault" element={<VaultDashboard />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/stake" element={<Stake />} />
            <Route path="/oracle" element={<Oracle />} />
            <Route path="/prop-price" element={<PropPriceOracle />} />
            <Route path="/security-lab" element={<SecurityLab />} />
            <Route path="/property/:id" element={<PropertyDetail landRegistryAddress={landRegistryAddress} propertyTokenFactoryAddress={contracts?.propertyTokenFactory} propertyTokens={contracts?.propertyTokens} mockUSDCAddress={contracts?.mockUSDC} />} />
            <Route
              path="/governance"
              element={
                <Governance
                  account={account}
                  landRegistryAddress={landRegistryAddress}
                  propertyDisputeAddress={propertyDisputeAddress}
                  governanceDAOAddress={contracts?.governanceDAO}
                  factoryAddress={contracts?.propertyTokenFactory}
                  onError={setError}
                  onSuccess={pushSuccess}
                />
              }
            />
            <Route
              path="/admin"
              element={
                <Admin
                  account={account}
                  landRegistryAddress={landRegistryAddress}
                  propertyTokenFactoryAddress={contracts?.propertyTokenFactory}
                  onError={setError}
                  onSuccess={pushSuccess}
                  onMutate={() => setMarketRefreshKey((value) => value + 1)}
                />
              }
            />

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppShell />
    </WalletProvider>
  );
}

export default App;
