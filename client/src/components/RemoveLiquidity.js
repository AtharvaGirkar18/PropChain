import React, { useState } from "react";
import { Contract, parseEther, formatEther, formatUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import LIQUIDITY_POOL_ABI from "../abis/LiquidityPool.json";

/**
 * RemoveLiquidity
 * Burn LP-PROP tokens to redeem proportional PropertyTokens and MockUSDC assets.
 *
 * Experiment 4 — AMM Liquidity Pool
 */
export default function RemoveLiquidity({
  poolAddress,
  poolData,
  onSuccess,
  onError,
  onRefresh,
}) {
  const { signer, isConnected } = useWallet();

  const [lpInput, setLpInput] = useState("");
  const [percentSelected, setPercentSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  const { reserveA = 0n, reserveB = 0n, totalSupply = 0n, userLP = 0n } = poolData || {};

  const userLpNum = Number(formatEther(userLP));

  // Handle quick percentage selection (25%, 50%, 75%, 100%)
  const handleSelectPercent = (pct) => {
    setPercentSelected(pct);
    if (userLP === 0n) {
      setLpInput("0");
      return;
    }
    const factor = pct === 100 ? 100n : pct === 75 ? 75n : pct === 50 ? 50n : 25n;
    const chosenLp = (userLP * factor) / 100n;
    setLpInput(formatEther(chosenLp));
  };

  const handleLpInputChange = (val) => {
    setLpInput(val);
    setPercentSelected(0);
  };

  // Parse input
  let parsedLp = 0n;
  try {
    if (lpInput && Number(lpInput) > 0) parsedLp = parseEther(lpInput);
  } catch {
    /* ignore invalid parse */
  }

  const hasEnoughLp = userLP >= parsedLp;

  // Calculate proportional outputs
  let expectedProp = 0n;
  let expectedUsdc = 0n;
  if (parsedLp > 0n && totalSupply > 0n) {
    expectedProp = (parsedLp * reserveA) / totalSupply;
    expectedUsdc = (parsedLp * reserveB) / totalSupply;
  }

  // Execute Remove Liquidity
  const handleRemove = async (e) => {
    e.preventDefault();
    if (!signer || !poolAddress) return;
    if (parsedLp === 0n) {
      onError("Please specify an amount of LP tokens to burn.");
      return;
    }
    if (!hasEnoughLp) {
      onError("Specified LP amount exceeds your LP balance.");
      return;
    }

    try {
      setLoading(true);
      const poolContract = new Contract(poolAddress, LIQUIDITY_POOL_ABI.abi, signer);

      const tx = await poolContract.removeLiquidity(parsedLp);
      const receipt = await tx.wait();

      onSuccess(`Successfully burned LP tokens and redeemed underlying assets! Tx: ${receipt.hash.slice(0, 10)}...`);
      setLpInput("");
      setPercentSelected(0);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Remove liquidity failed:", err);
      onError(err.reason || err.message || "Failed to remove liquidity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="liquidity-action-card">
      <div className="action-card-header">
        <h4>Remove Liquidity (Withdraw)</h4>
        <span className="card-badge" style={{ borderColor: "rgba(220, 38, 38, 0.4)", color: "#f87171" }}>
          Burn LP Tokens
        </span>
      </div>
      <p className="card-desc">
        Burn your LP-PROP tokens to withdraw your share of PropertyToken and MockUSDC reserves,
        including all accrued 0.3% trading fees.
      </p>

      {userLP === 0n ? (
        <div className="pool-alert-empty">
          <span>ℹ️</span>
          <div>You do not currently have any LP-PROP tokens in this pool.</div>
        </div>
      ) : (
        <form onSubmit={handleRemove} className="liquidity-form">
          <div className="form-group">
            <div className="input-label-row">
              <label htmlFor="lpBurnAmount">LP Tokens to Burn</label>
              <span className="balance-hint">
                Available: {userLpNum.toFixed(4)} LP-PROP
              </span>
            </div>

            <div className="token-input-row">
              <input
                id="lpBurnAmount"
                type="number"
                step="any"
                min="0"
                placeholder="0.0"
                value={lpInput}
                onChange={(e) => handleLpInputChange(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="btn btn-outline max-btn"
                onClick={() => handleSelectPercent(100)}
                disabled={loading}
              >
                100%
              </button>
            </div>
            {!hasEnoughLp && parsedLp > 0n && (
              <span className="error-hint">Exceeds available LP token balance</span>
            )}
          </div>

          {/* Quick Percentage Presets */}
          <div className="percent-presets">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                className={`percent-btn ${percentSelected === pct ? "active" : ""}`}
                onClick={() => handleSelectPercent(pct)}
                disabled={loading}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Proportional Output Preview */}
          <div className="expected-lp-box">
            <span style={{ fontSize: "0.8rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              You will receive:
            </span>
            <div className="expected-return-grid">
              <div className="return-item">
                <span className="return-label">PropertyToken (PROP)</span>
                <span className="return-val text-accent">
                  ≈ {Number(formatEther(expectedProp)).toFixed(4)} PROP
                </span>
              </div>
              <div className="return-item">
                <span className="return-label">MockUSDC (mUSDC)</span>
                <span className="return-val text-accent">
                  ≈ {Number(formatUnits(expectedUsdc, 6)).toFixed(2)} mUSDC
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-danger"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={
              loading ||
              parsedLp === 0n ||
              !hasEnoughLp ||
              !isConnected
            }
          >
            {loading ? "Burning LP & Withdrawing..." : "Burn LP & Receive Assets"}
          </button>
        </form>
      )}
    </div>
  );
}
