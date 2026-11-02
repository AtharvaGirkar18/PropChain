import React from "react";
import { formatEther, formatUnits } from "ethers";

/**
 * PoolStats
 * Displays key AMM metrics: reserves, spot price, constant k, total LP supply,
 * and caller's LP position & pool share.
 *
 * Experiment 4 — AMM Liquidity Pool
 */
export default function PoolStats({
  poolData,
  loading,
  onRefresh,
}) {
  const {
    reserveA = 0n,
    reserveB = 0n,
    totalSupply = 0n,
    userLP = 0n,
    lastTimestamp = 0,
  } = poolData || {};

  const resA = Number(formatEther(reserveA));
  const resB = Number(formatUnits(reserveB, 6));
  const totalLpNum = Number(formatEther(totalSupply));
  const userLpNum = Number(formatEther(userLP));

  const isEmpty = reserveA === 0n || reserveB === 0n;

  // Spot prices
  const pricePropInUsdc = !isEmpty && resA > 0 ? (resB / resA).toFixed(4) : "—";
  const priceUsdcInProp = !isEmpty && resB > 0 ? (resA / resB).toFixed(4) : "—";

  // User share percentage
  const userSharePct =
    totalSupply > 0n && userLP > 0n
      ? ((Number(userLP * 10000n / totalSupply)) / 100).toFixed(2)
      : "0.00";

  // User underlying assets
  const userPropUnderlying =
    totalSupply > 0n && userLP > 0n
      ? Number(formatEther((userLP * reserveA) / totalSupply)).toFixed(4)
      : "0.0000";

  const userUsdcUnderlying =
    totalSupply > 0n && userLP > 0n
      ? Number(formatUnits((userLP * reserveB) / totalSupply, 6)).toFixed(2)
      : "0.00";

  // Constant Product k display (scientific or formatted)
  const kDisplay = isEmpty ? "0" : `${(resA * resB).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="pool-stats-container">
      <div className="pool-stats-header">
        <div className="pool-title-group">
          <h3>Pool Overview & Metrics</h3>
          <span className="pool-pill">Constant Product AMM (x · y = k)</span>
          <span className="pool-fee-pill">0.3% LP Fee</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh pool metrics"
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {isEmpty && (
        <div className="pool-alert-empty">
          <span>⚡</span>
          <div>
            <strong>Pool is uninitialized.</strong> No liquidity has been deposited yet.
            The first liquidity provider establishes the initial exchange ratio.
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="vault-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Reserve A (Property)</span>
          <span className="stat-value">{resA.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          <span className="stat-unit">PROP Tokens</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Reserve B (Stablecoin)</span>
          <span className="stat-value">{resB.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className="stat-unit">mUSDC</span>
        </div>

        <div className="stat-card stat-card-accent">
          <span className="stat-label">Spot Price</span>
          <span className="stat-value apy-value">
            {pricePropInUsdc !== "—" ? `${pricePropInUsdc} USDC` : "No ratio"}
          </span>
          <span className="stat-unit">1 PROP ≈ {pricePropInUsdc} mUSDC</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total LP Supply</span>
          <span className="stat-value">{totalLpNum.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          <span className="stat-unit">LP-PROP Tokens</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Invariant (k = x · y)</span>
          <span className="stat-value" style={{ fontSize: "1.1rem" }}>{kDisplay}</span>
          <span className="stat-unit">Constant Product</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Inverse Price</span>
          <span className="stat-value" style={{ fontSize: "1.1rem" }}>
            {priceUsdcInProp !== "—" ? `${priceUsdcInProp} PROP` : "—"}
          </span>
          <span className="stat-unit">1 mUSDC ≈ {priceUsdcInProp} PROP</span>
        </div>
      </div>

      {/* User Position Card */}
      <div className="user-position-card">
        <div className="user-pos-header">
          <h4>Your Liquidity Position</h4>
          <span className="user-share-badge">{userSharePct}% of Pool</span>
        </div>
        <div className="user-pos-grid">
          <div className="pos-item">
            <span className="pos-label">Your LP Balance</span>
            <span className="pos-val">
              {userLpNum > 0 && userLpNum < 0.001
                ? userLpNum.toFixed(6)
                : userLpNum.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
              LP
            </span>
          </div>
          <div className="pos-item">
            <span className="pos-label">Pooled PropertyToken</span>
            <span className="pos-val text-accent">{userPropUnderlying} PROP</span>
          </div>
          <div className="pos-item">
            <span className="pos-label">Pooled MockUSDC</span>
            <span className="pos-val text-accent">{userUsdcUnderlying} mUSDC</span>
          </div>
        </div>
        {lastTimestamp > 0 && (
          <div className="pool-sync-time">
            Last pool synchronization: {new Date(Number(lastTimestamp) * 1000).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
