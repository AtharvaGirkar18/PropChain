import React, { useState, useEffect, useCallback } from "react";
import { Contract, formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";

import MintFaucet  from "../components/MintFaucet";
import InvestPanel from "../components/InvestPanel";
import VaultPanel  from "../components/VaultPanel";

import MOCK_USDC_ABI      from "../abis/MockUSDC.json";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";

const VAULT_TABS = [
  { id: "invest",  label: "💰 Invest"      },
  { id: "vault",   label: "🏦 Vault"       },
  { id: "faucet",  label: "💧 Faucet"      },
];

export default function VaultDashboard() {
  const { signer, account, chainId, isConnected } = useWallet();

  const [activeTab, setActiveTab] = useState("invest");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  // Header stats
  const [usdcBal,   setUsdcBal]   = useState(null);
  const [tokenBal,  setTokenBal]  = useState(null);

  // Resolve addresses from chain
  const contracts = chainId ? getContractsForChain(chainId) : null;
  const mockUSDCAddress      = contracts?.mockUSDC      || "";
  const propertyTokenAddress = contracts?.propertyToken || "";
  const propertyVaultAddress = contracts?.propertyVault || "";

  const vaultReady =
    hasValidAddress(mockUSDCAddress) &&
    hasValidAddress(propertyTokenAddress) &&
    hasValidAddress(propertyVaultAddress);

  // ── Fetch header balances ─────────────────────────────────────────────────
  const refreshHeader = useCallback(async () => {
    if (!signer || !account || !vaultReady) return;
    try {
      const usdc = new Contract(mockUSDCAddress,      MOCK_USDC_ABI.abi,      signer);
      const pt   = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const [u, t] = await Promise.all([
        usdc.balanceOf(account),
        pt.balanceOf(account),
      ]);
      setUsdcBal((Number(u) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 }));
      setTokenBal(Number(formatEther(t)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
    } catch { /* silent */ }
  }, [signer, account, vaultReady, mockUSDCAddress, propertyTokenAddress]);

  useEffect(() => { refreshHeader(); }, [refreshHeader]);

  // Flash success banner
  const pushSuccess = (msg) => {
    setSuccess(msg);
    setError("");
    refreshHeader();
    setTimeout(() => setSuccess(""), 4000);
  };
  const pushError = (msg) => {
    setError(msg);
    setSuccess("");
    setTimeout(() => setError(""), 6000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="panel">
      {/* ── Page header ── */}
      <div className="vault-page-header">
        <div>
          <h2>Vault Dashboard</h2>
          <p className="panel-note">
            Invest in fractional property tokens • Earn rental yield • Deposit into ERC-4626 vault
          </p>
        </div>
        <div className="vault-badge">ERC-4626</div>
      </div>

      {/* ── Not connected banner ── */}
      {!isConnected && (
        <div className="alert alert-warning">
          Connect your wallet via the top-right button to start investing.
        </div>
      )}

      {/* ── Addresses not configured ── */}
      {isConnected && !vaultReady && (
        <div className="alert alert-warning">
          Vault contracts are not configured for this network. Switch to Sepolia or update{" "}
          <code>client/src/config/contracts.js</code> with deployed addresses.
        </div>
      )}

      {/* ── Alerts ── */}
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Header stats (only when ready) ── */}
      {isConnected && vaultReady && (
        <div className="vault-header-stats">
          <div className="hstat">
            <span className="hstat-label">mUSDC Balance</span>
            <span className="hstat-value">{usdcBal ?? "…"} mUSDC</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">PROP-1 Balance</span>
            <span className="hstat-value">{tokenBal ?? "…"} PROP-1</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">Network</span>
            <span className="hstat-value">{contracts?.name ?? "—"}</span>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="inline-tabs" style={{ marginTop: "1.4rem" }}>
        {VAULT_TABS.map(t => (
          <button
            key={t.id}
            className={`tab-button ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="vault-tab-content">
        {activeTab === "faucet" && (
          <div>
            <p className="panel-note" style={{ marginBottom: "1rem" }}>
              No mUSDC? Use the faucet to get 10,000 test tokens instantly.
            </p>
            <MintFaucet
              mockUSDCAddress={mockUSDCAddress}
              onSuccess={pushSuccess}
              onError={pushError}
            />
          </div>
        )}

        {activeTab === "invest" && (
          <div>
            <div className="property-invest-header">
              <div>
                <h3>Property #1 — PROP-1 Token</h3>
                <p className="panel-note">
                  Buy fractional ownership tokens. Token holders earn proportional
                  rental income when the property owner deposits rent.
                </p>
              </div>
            </div>
            <InvestPanel
              propertyTokenAddress={propertyTokenAddress}
              mockUSDCAddress={mockUSDCAddress}
              onSuccess={pushSuccess}
              onError={pushError}
            />
          </div>
        )}

        {activeTab === "vault" && (
          <div>
            <p className="panel-note" style={{ marginBottom: "1rem" }}>
              Deposit PROP-1 tokens into the ERC-4626 vault. Your vault shares
              (deVAULT) appreciate in value as the admin notifies yield.
            </p>
            <VaultPanel
              propertyVaultAddress={propertyVaultAddress}
              propertyTokenAddress={propertyTokenAddress}
              onSuccess={pushSuccess}
              onError={pushError}
            />
          </div>
        )}
      </div>

      {/* ── ERC-4626 explainer ── */}
      <div className="erc4626-explainer">
        <h4>How ERC-4626 Works</h4>
        <div className="explainer-steps">
          <div className="exp-step">
            <span className="exp-num">1</span>
            <p><strong>Deposit</strong> PROP-1 tokens → receive <strong>deVAULT</strong> shares</p>
          </div>
          <span className="exp-arrow">→</span>
          <div className="exp-step">
            <span className="exp-num">2</span>
            <p>Admin calls <strong>notifyYield()</strong> → vault holds more PROP-1</p>
          </div>
          <span className="exp-arrow">→</span>
          <div className="exp-step">
            <span className="exp-num">3</span>
            <p><strong>Redeem</strong> shares → get back more PROP-1 than you deposited</p>
          </div>
        </div>
      </div>
    </section>
  );
}
