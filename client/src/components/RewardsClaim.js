import React, { useState, useEffect, useCallback } from "react";
import { Contract, formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";

import STAKING_ABI from "../abis/StakingRewards.json";
import DCE_ABI     from "../abis/DCEToken.json";

/**
 * RewardsClaim — Displays pending DCE rewards and lets user claim or exit.
 *
 * Props:
 *   stakingAddress  — deployed StakingRewards address
 *   dceTokenAddress — deployed DCEToken address
 *   onSuccess(msg)  — success callback
 *   onError(msg)    — error callback
 *   onRefresh()     — signal parent to re-fetch
 */
export default function RewardsClaim({
  stakingAddress,
  dceTokenAddress,
  onSuccess,
  onError,
  onRefresh,
}) {
  const { signer, account } = useWallet();

  const [loading,     setLoading]     = useState(false);
  const [earned,      setEarned]      = useState(0n);
  const [dceBal,      setDceBal]      = useState(0n);
  const [totalMinted, setTotalMinted] = useState(0n);
  const [stakedBal,   setStakedBal]   = useState(0n);

  // Live tick — refresh earned every 10 s for real-time feel
  const fetchData = useCallback(async () => {
    if (!signer || !account || !stakingAddress || !dceTokenAddress) return;
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const dce     = new Contract(dceTokenAddress, DCE_ABI.abi, signer);

      const [earnedVal, dceBalVal, totalSupply, staked] = await Promise.all([
        staking.earned(account).catch(() => 0n),
        dce.balanceOf(account).catch(() => 0n),
        dce.totalSupply().catch(() => 0n),
        staking.stakedBalance(account).catch(() => 0n),
      ]);

      setEarned(earnedVal);
      setDceBal(dceBalVal);
      setTotalMinted(totalSupply);
      setStakedBal(staked);
    } catch (err) {
      console.error("RewardsClaim fetch error:", err);
    }
  }, [signer, account, stakingAddress, dceTokenAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fmt = (val, d = 4) =>
    Number(formatEther(val)).toLocaleString("en-US", { maximumFractionDigits: d });

  // ── Claim Rewards ─────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const tx      = await staking.claimRewards();
      await tx.wait();
      onSuccess?.(`Claimed ${fmt(earned)} DCE rewards!`);
      fetchData();
      onRefresh?.();
    } catch (err) {
      onError?.(err.reason || err.message || "Claim failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Exit (Unstake All + Claim) ────────────────────────────────────────────
  const handleExit = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const tx      = await staking.exit();
      await tx.wait();
      onSuccess?.("Exit complete — LP tokens returned and DCE claimed.");
      fetchData();
      onRefresh?.();
    } catch (err) {
      onError?.(err.reason || err.message || "Exit failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rewards-claim-panel">
      {/* ── Reward Stats ── */}
      <div className="rewards-stats-grid">
        <div className="reward-stat reward-stat-highlight">
          <span className="reward-stat-label">⏳ Pending Rewards</span>
          <span className="reward-stat-value glow-green">{fmt(earned)} DCE</span>
          <span className="reward-stat-sub">Accumulating every second you're staked</span>
        </div>
        <div className="reward-stat">
          <span className="reward-stat-label">💰 Your DCE Balance</span>
          <span className="reward-stat-value">{fmt(dceBal)} DCE</span>
          <span className="reward-stat-sub">Claimed rewards in wallet</span>
        </div>
        <div className="reward-stat">
          <span className="reward-stat-label">🏭 Total DCE Minted</span>
          <span className="reward-stat-value">{fmt(totalMinted, 2)} DCE</span>
          <span className="reward-stat-sub">Protocol-wide total supply</span>
        </div>
        <div className="reward-stat">
          <span className="reward-stat-label">📌 LP Currently Staked</span>
          <span className="reward-stat-value">{fmt(stakedBal)} LP</span>
          <span className="reward-stat-sub">Your active stake position</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="rewards-actions">
        <button
          type="button"
          className="btn btn-primary rewards-btn"
          onClick={handleClaim}
          disabled={loading || earned === 0n}
        >
          {loading ? "Claiming…" : `Claim ${fmt(earned)} DCE`}
        </button>

        <button
          type="button"
          className="btn btn-outline rewards-btn exit-btn"
          onClick={handleExit}
          disabled={loading || (stakedBal === 0n && earned === 0n)}
          title="Unstake all LP tokens and claim all pending DCE in one transaction"
        >
          {loading ? "Exiting…" : "🚪 Exit (Unstake All + Claim)"}
        </button>
      </div>

      {/* ── How Rewards Work ── */}
      <div className="rewards-explainer">
        <h4>How Yield Farming Works</h4>
        <div className="explainer-steps">
          <div className="exp-step">
            <span className="exp-num">1</span>
            <p>Provide liquidity on the <strong>Trade</strong> page to receive <strong>LP tokens</strong></p>
          </div>
          <span className="exp-arrow">→</span>
          <div className="exp-step">
            <span className="exp-num">2</span>
            <p>Stake LP tokens here — rewards accrue <strong>every second</strong> on-chain</p>
          </div>
          <span className="exp-arrow">→</span>
          <div className="exp-step">
            <span className="exp-num">3</span>
            <p>Claim <strong>DCE tokens</strong> anytime, or use <em>Exit</em> to withdraw everything at once</p>
          </div>
        </div>
      </div>
    </div>
  );
}
