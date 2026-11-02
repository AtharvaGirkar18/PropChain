import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Contract, formatEther, formatUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";

import PoolStats from "../components/PoolStats";
import AddLiquidity from "../components/AddLiquidity";
import RemoveLiquidity from "../components/RemoveLiquidity";
import SwapPanel from "../components/SwapPanel";

import LIQUIDITY_POOL_ABI from "../abis/LiquidityPool.json";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";
import MOCK_USDC_ABI from "../abis/MockUSDC.json";

const TRADE_TABS = [
  { id: "liquidity", label: "💧 Liquidity Pool" },
  { id: "swap",      label: "🔀 DEX Swap"        },
  { id: "info",      label: "📘 AMM Math & Info" },
];

export default function Trade() {
  const { signer, account, chainId, isConnected } = useWallet();

  const [activeTab, setActiveTab] = useState("liquidity");
  const [subTab, setSubTab] = useState("add"); // "add" or "remove"

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Deployed address override (helpful for Remix testnet workflow)
  const [customPoolAddress, setCustomPoolAddress] = useState(() => {
    return sessionStorage.getItem("decentraestate_lp_address") || "";
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddressInput, setTempAddressInput] = useState("");

  // Resolving addresses from contracts.js
  const contracts             = useMemo(() => (chainId ? getContractsForChain(chainId) : null), [chainId]);
  const defaultPoolAddress    = contracts?.liquidityPool  || "";
  const propertyTokenAddress  = contracts?.propertyToken  || "";
  const mockUSDCAddress       = contracts?.mockUSDC       || "";
  const dceTokenAddress        = contracts?.dceToken       || "";
  const dcePoolAddress         = contracts?.liquidityPoolDCE || "";
  const dexRouterAddress      = contracts?.dexRouter      || ""; // Exp 6

  // Effective pool address (custom override takes precedence if valid)
  const effectivePoolAddress = hasValidAddress(customPoolAddress)
    ? customPoolAddress
    : defaultPoolAddress;

  const isPoolConfigured = hasValidAddress(effectivePoolAddress);
  const isTokensConfigured =
    hasValidAddress(propertyTokenAddress) && hasValidAddress(mockUSDCAddress);

  // Pool on-chain data
  const [poolData, setPoolData] = useState({
    reserveA: 0n,
    reserveB: 0n,
    totalSupply: 0n,
    userLP: 0n,
    lastTimestamp: 0,
  });

  // Top header token balances
  const [headerBalances, setHeaderBalances] = useState({
    propBal: "0.00",
    usdcBal: "0.00",
    lpBal: "0.00",
  });

  // ── Fetch Pool & Header Data ──────────────────────────────────────────────
  const fetchPoolData = useCallback(async () => {
    if (!signer || !isPoolConfigured || !isTokensConfigured) return;
    try {
      setLoading(true);
      const poolContract = new Contract(effectivePoolAddress, LIQUIDITY_POOL_ABI.abi, signer);
      const propContract = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const usdcContract = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);

      const [reserves, totalLP, userLPVal, pBal, uBal] = await Promise.all([
        poolContract.getReserves().catch(() => [0n, 0n, 0]),
        poolContract.totalSupply().catch(() => 0n),
        account ? poolContract.balanceOf(account).catch(() => 0n) : 0n,
        account ? propContract.balanceOf(account).catch(() => 0n) : 0n,
        account ? usdcContract.balanceOf(account).catch(() => 0n) : 0n,
      ]);

      const reserveA = reserves[0] || 0n;
      const reserveB = reserves[1] || 0n;
      const lastTimestamp = Number(reserves[2] || 0);

      setPoolData({
        reserveA,
        reserveB,
        totalSupply: totalLP,
        userLP: userLPVal,
        lastTimestamp,
      });

      const formatLpNumber = (val) => {
        if (!val || val === 0n) return "0.0000";
        const n = Number(formatEther(val));
        return n > 0 && n < 0.001 ? n.toFixed(6) : n.toFixed(4);
      };

      setHeaderBalances({
        propBal: Number(formatEther(pBal)).toFixed(2),
        usdcBal: Number(formatUnits(uBal, 6)).toFixed(2),
        lpBal: formatLpNumber(userLPVal),
      });
    } catch (err) {
      console.error("Error loading pool state:", err);
    } finally {
      setLoading(false);
    }
  }, [
    signer,
    account,
    effectivePoolAddress,
    propertyTokenAddress,
    mockUSDCAddress,
    isPoolConfigured,
    isTokensConfigured,
  ]);

  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  // Notifications
  const pushSuccess = (msg) => {
    setSuccess(msg);
    setError("");
    fetchPoolData();
    setTimeout(() => setSuccess(""), 4500);
  };

  const pushError = (msg) => {
    setError(msg);
    setSuccess("");
    setTimeout(() => setError(""), 6500);
  };

  // Quick Faucet handler
  const handleClaimFaucet = async () => {
    if (!signer || !mockUSDCAddress) return;
    try {
      setLoading(true);
      const usdc = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);
      const tx = await usdc.faucet();
      await tx.wait();
      pushSuccess("Claimed 10,000 mUSDC from testnet faucet!");
    } catch (err) {
      pushError(err.reason || err.message || "Faucet claim failed.");
    } finally {
      setLoading(false);
    }
  };

  // Address override handler
  const handleSaveAddress = () => {
    if (tempAddressInput && hasValidAddress(tempAddressInput.trim())) {
      const trimmed = tempAddressInput.trim();
      setCustomPoolAddress(trimmed);
      sessionStorage.setItem("decentraestate_lp_address", trimmed);
      setIsEditingAddress(false);
      pushSuccess(`Liquidity Pool address set to ${trimmed.slice(0, 10)}...`);
    } else {
      pushError("Invalid contract address. Must be a 42-character hex address.");
    }
  };

  const handleClearCustomAddress = () => {
    setCustomPoolAddress("");
    sessionStorage.removeItem("decentraestate_lp_address");
    setIsEditingAddress(false);
    pushSuccess("Reset to default network address.");
  };

  return (
    <section className="panel">
      {/* ── Page Header ── */}
      <div className="trade-page-header">
        <div>
          <h2>AMM Liquidity & Trade</h2>
          <p className="panel-note">
            Constant-Product AMM (x · y = k) • Provide liquidity • Earn 0.3% fees • Instant swaps via DEX Router
          </p>
        </div>
        <div className="trade-badge-group">
          <span className="badge-chain">{contracts?.name || "Sepolia Testnet"}</span>
        </div>
      </div>

      {/* ── Wallet Status & Header Balances ── */}
      {isConnected && (
        <div className="trade-header-stats">
          <div className="hstat">
            <span className="hstat-label">Your Property Tokens</span>
            <span className="hstat-value">{headerBalances.propBal} PROP</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">Your Test Stablecoin</span>
            <span className="hstat-value">{headerBalances.usdcBal} mUSDC</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">Your Pool Liquidity</span>
            <span className="hstat-value text-accent">{headerBalances.lpBal} LP</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm faucet-quick-btn"
            onClick={handleClaimFaucet}
            disabled={loading}
            title="Mint 10,000 mUSDC for testing"
          >
            💧 Get 10,000 mUSDC
          </button>
        </div>
      )}

      {/* ── Alert Banners ── */}
      {!isConnected && (
        <div className="alert alert-warning">
          Please connect your MetaMask wallet to interact with the AMM Liquidity Pool.
        </div>
      )}

      {/* ── Remix Deployment Helper Banner ── */}
      {!isPoolConfigured && isConnected && (
        <div className="remix-deploy-box">
          <div className="remix-header">
            <h4>Deploy LiquidityPool + DEXRouter in Remix (Sepolia)</h4>
            <span className="remix-step-tag">Exp 4 + Exp 6</span>
          </div>
          <p className="remix-desc">
            Deploy <code>LiquidityPool.sol</code> first, then deploy <code>DEXRouter.sol</code> pointing at the pool.
          </p>
          <div className="remix-params-card">
            <div className="param-item">
              <span className="param-name">LiquidityPool — _tokenA (PropertyToken):</span>
              <code className="param-val">{propertyTokenAddress || "0xaF81486e637dFb386E9Fc0Fb6Dd23bb6F99BABcB"}</code>
            </div>
            <div className="param-item">
              <span className="param-name">LiquidityPool — _tokenB (MockUSDC):</span>
              <code className="param-val">{mockUSDCAddress || "0x5282a9DBd046B4d03DBa74f58C85E12a331F3A2f"}</code>
            </div>
            <div className="param-item" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
              <span className="param-name">DEXRouter — _pool (LiquidityPool address):</span>
              <code className="param-val">{effectivePoolAddress || "(deploy LiquidityPool first)"}</code>
            </div>
          </div>

          <div className="remix-input-row">
            <input
              type="text"
              placeholder="Paste your deployed LiquidityPool address (0x...)"
              value={tempAddressInput}
              onChange={(e) => setTempAddressInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveAddress}
            >
              Connect Deployed Pool
            </button>
          </div>
        </div>
      )}

      {/* ── Active Pool Address Bar ── */}
      {isPoolConfigured && (
        <div className="pool-address-bar">
          <div className="pool-addr-info">
            <span className="addr-tag">AMM Pool Contract:</span>
            <code className="addr-code">{effectivePoolAddress}</code>
            {customPoolAddress && <span className="override-pill">Session Active</span>}
          </div>
          <div className="pool-addr-actions">
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => {
                setTempAddressInput(effectivePoolAddress);
                setIsEditingAddress(!isEditingAddress);
              }}
            >
              {isEditingAddress ? "Cancel" : "Change Address"}
            </button>
            {customPoolAddress && (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleClearCustomAddress}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {isEditingAddress && (
        <div className="address-edit-box">
          <input
            type="text"
            placeholder="0x..."
            value={tempAddressInput}
            onChange={(e) => setTempAddressInput(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAddress}>
            Save
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Main Navigation Tabs ── */}
      <div className="trade-nav-tabs">
        {TRADE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`trade-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Liquidity Pool (Exp 4 Primary) ── */}
      {activeTab === "liquidity" && (
        <div className="trade-tab-content">
          {/* Top Pool Statistics */}
          <PoolStats
            poolData={poolData}
            loading={loading}
            onRefresh={fetchPoolData}
          />

          {/* Sub Navigation: Add vs Remove Liquidity */}
          <div className="liquidity-sub-tabs">
            <button
              type="button"
              className={`sub-tab-btn ${subTab === "add" ? "active" : ""}`}
              onClick={() => setSubTab("add")}
            >
              ➕ Supply Liquidity
            </button>
            <button
              type="button"
              className={`sub-tab-btn ${subTab === "remove" ? "active" : ""}`}
              onClick={() => setSubTab("remove")}
            >
              ➖ Withdraw Liquidity
            </button>
          </div>

          {/* Action Panels */}
          {subTab === "add" ? (
            <AddLiquidity
              poolAddress={effectivePoolAddress}
              propertyTokenAddress={propertyTokenAddress}
              mockUSDCAddress={mockUSDCAddress}
              poolData={poolData}
              onSuccess={pushSuccess}
              onError={pushError}
              onRefresh={fetchPoolData}
            />
          ) : (
            <RemoveLiquidity
              poolAddress={effectivePoolAddress}
              poolData={poolData}
              onSuccess={pushSuccess}
              onError={pushError}
              onRefresh={fetchPoolData}
            />
          )}
        </div>
      )}

      {/* ── Tab 2: Instant Swap ── */}
      {activeTab === "swap" && (
        <div className="trade-tab-content">
          <SwapPanel
            routerAddress={dexRouterAddress}
            poolAddress={effectivePoolAddress}
            propertyTokenAddress={propertyTokenAddress}
            mockUSDCAddress={mockUSDCAddress}
            dceTokenAddress={dceTokenAddress}
            dcePoolAddress={dcePoolAddress}
            poolData={poolData}
            onSuccess={pushSuccess}
            onError={pushError}
            onRefresh={fetchPoolData}
          />
        </div>
      )}

      {/* ── Tab 3: AMM Math & Educational Info ── */}
      {activeTab === "info" && (
        <div className="trade-tab-content">
          <div className="amm-explainer-card">
            <h3>Automated Market Maker (AMM) Mechanics</h3>
            <p>
              This pool implements the foundational constant-product market maker popularized by Uniswap v2:
            </p>

            <div className="amm-formula-banner">
              <code>x · y = k</code>
              <p>Where <strong>x</strong> is PropertyToken reserve, <strong>y</strong> is MockUSDC reserve, and <strong>k</strong> remains constant during swaps.</p>
            </div>

            <div className="amm-features-grid">
              <div className="feature-card">
                <h4>💧 Liquidity Provision</h4>
                <p>
                  Liquidity providers supply both tokens in equal value proportion. In return, they receive
                  <code>LP-PROP</code> tokens that represent proportional ownership of the entire reserve pool.
                </p>
              </div>

              <div className="feature-card">
                <h4>🪙 0.3% Fee Accumulation</h4>
                <p>
                  Every swap charges a 0.3% trading fee that remains inside the pool reserves. This increases
                  <code>k</code> over time and ensures each LP token is redeemable for more underlying assets upon withdrawal.
                </p>
              </div>

              <div className="feature-card">
                <h4>🛡️ Minimum Liquidity Lock</h4>
                <p>
                  On initial pool creation, <code>1,000</code> units of LP are permanently minted to <code>0xdead</code>.
                  This standard Uniswap defense prevents the "first depositor inflation exploit".
                </p>
              </div>

              <div className="feature-card">
                <h4>🔄 Constant-Product Swap Pricing</h4>
                <p>
                  Output amount calculation with fee:
                  <br />
                  <code>amountOut = (amountIn · 997 · resOut) / (resIn · 1000 + amountIn · 997)</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
