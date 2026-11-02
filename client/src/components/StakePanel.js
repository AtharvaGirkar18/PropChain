import React, { useState, useEffect, useCallback } from "react";
import { Contract, formatEther, parseEther } from "ethers";
import { useWallet } from "../context/WalletContext";

import STAKING_ABI from "../abis/StakingRewards.json";
import LP_ABI      from "../abis/LiquidityPool.json";

/**
 * StakePanel — Stake / Unstake LP tokens in the StakingRewards contract.
 *
 * Props:
 *   stakingAddress  — deployed StakingRewards address
 *   lpTokenAddress  — LP token address (LiquidityPool itself is the ERC-20)
 *   onSuccess(msg)  — success callback
 *   onError(msg)    — error callback
 *   onRefresh()     — signal parent to re-fetch global balances
 */
export default function StakePanel({
  stakingAddress,
  lpTokenAddress,
  onSuccess,
  onError,
  onRefresh,
}) {
  const { signer, account } = useWallet();

  const [stakeAmount,   setStakeAmount]   = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [loading,       setLoading]       = useState(false);

  // On-chain state
  const [lpBalance,    setLpBalance]    = useState(0n);
  const [stakedBal,    setStakedBal]    = useState(0n);
  const [totalStaked,  setTotalStaked]  = useState(0n);
  const [rewardRate,   setRewardRate]   = useState(0n);
  const [allowance,    setAllowance]    = useState(0n);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!signer || !account || !stakingAddress || !lpTokenAddress) return;
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const lp      = new Contract(lpTokenAddress, LP_ABI.abi, signer);

      const [lpBal, staked, total, rate, allowanceVal] = await Promise.all([
        lp.balanceOf(account).catch(() => 0n),
        staking.stakedBalance(account).catch(() => 0n),
        staking.totalStaked().catch(() => 0n),
        staking.rewardRate().catch(() => 0n),
        lp.allowance(account, stakingAddress).catch(() => 0n),
      ]);

      setLpBalance(lpBal);
      setStakedBal(staked);
      setTotalStaked(total);
      setRewardRate(rate);
      setAllowance(allowanceVal);
    } catch (err) {
      console.error("StakePanel fetch error:", err);
    }
  }, [signer, account, stakingAddress, lpTokenAddress]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmt = (val, decimals = 4) => {
    if (!val || val === 0n) return "0.0000";
    const num = Number(formatEther(val));
    const dec = num > 0 && num < 0.001 ? 6 : decimals;
    return num.toLocaleString("en-US", { maximumFractionDigits: dec });
  };

  const dcePerDay = () => {
    if (rewardRate === 0n || totalStaked === 0n || stakedBal === 0n) return "0";
    // rewardRate is DCE per second per totalStaked. User share:
    const userShare = (rewardRate * stakedBal * 86400n) / totalStaked;
    return Number(formatEther(userShare)).toFixed(4);
  };

  // ── Approve ─────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const lp = new Contract(lpTokenAddress, LP_ABI.abi, signer);
      const tx = await lp.approve(stakingAddress, parseEther(stakeAmount || "0"));
      await tx.wait();
      onSuccess?.("Approval confirmed! Now click Stake.");
      fetchData();
    } catch (err) {
      onError?.(err.reason || err.message || "Approval failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Stake ────────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!signer || !stakeAmount) return;
    setLoading(true);
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const amount  = parseEther(stakeAmount);
      const tx      = await staking.stake(amount);
      await tx.wait();
      setStakeAmount("");
      onSuccess?.(`Staked ${stakeAmount} LP tokens successfully.`);
      fetchData();
      onRefresh?.();
    } catch (err) {
      onError?.(err.reason || err.message || "Stake failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Unstake ──────────────────────────────────────────────────────────────────
  const handleUnstake = async () => {
    if (!signer || !unstakeAmount) return;
    setLoading(true);
    try {
      const staking = new Contract(stakingAddress, STAKING_ABI.abi, signer);
      const amount  = parseEther(unstakeAmount);
      const tx      = await staking.unstake(amount);
      await tx.wait();
      setUnstakeAmount("");
      onSuccess?.(`Unstaked ${unstakeAmount} LP tokens.`);
      fetchData();
      onRefresh?.();
    } catch (err) {
      onError?.(err.reason || err.message || "Unstake failed.");
    } finally {
      setLoading(false);
    }
  };

  const needsApproval =
    stakeAmount &&
    parseFloat(stakeAmount) > 0 &&
    allowance < parseEther(stakeAmount);

  const userSharePct =
    totalStaked > 0n
      ? ((Number(formatEther(stakedBal)) / Number(formatEther(totalStaked))) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="stake-panel">
      {/* ── Pool Stats ── */}
      <div className="stake-stats-grid">
        <div className="stake-stat">
          <span className="stake-stat-label">Your LP Balance</span>
          <span className="stake-stat-value">{fmt(lpBalance)} LP</span>
        </div>
        <div className="stake-stat">
          <span className="stake-stat-label">You Have Staked</span>
          <span className="stake-stat-value accent">{fmt(stakedBal)} LP</span>
        </div>
        <div className="stake-stat">
          <span className="stake-stat-label">Pool Share</span>
          <span className="stake-stat-value">{userSharePct}%</span>
        </div>
        <div className="stake-stat">
          <span className="stake-stat-label">Your DCE / Day</span>
          <span className="stake-stat-value green">{dcePerDay()} DCE</span>
        </div>
        <div className="stake-stat">
          <span className="stake-stat-label">Total LP Staked</span>
          <span className="stake-stat-value">{fmt(totalStaked)} LP</span>
        </div>
        <div className="stake-stat">
          <span className="stake-stat-label">Emission Rate</span>
          <span className="stake-stat-value">
            {Number(formatEther(rewardRate * 86400n)).toFixed(2)} DCE/day
          </span>
        </div>
      </div>

      {/* ── Stake Form ── */}
      <div className="stake-form-grid">
        {/* Stake */}
        <div className="stake-form-card">
          <h4 className="stake-form-title">🔒 Stake LP Tokens</h4>
          <p className="stake-form-note">
            Earn DCE rewards proportional to your pool share.
          </p>
          <div className="form-group">
            <label>Amount to Stake</label>
            <div className="token-input-row">
              <input
                type="number"
                placeholder="0.0"
                min="0"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline max-btn"
                onClick={() => setStakeAmount(formatEther(lpBalance))}
              >
                MAX
              </button>
            </div>
            <small className="cost-hint">
              Available: {fmt(lpBalance)} LP
            </small>
          </div>

          {needsApproval ? (
            <button
              type="button"
              className="btn btn-secondary step-btn"
              onClick={handleApprove}
              disabled={loading || !stakeAmount}
            >
              {loading ? "Approving…" : "1. Approve LP Tokens"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary step-btn"
              onClick={handleStake}
              disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
            >
              {loading ? "Staking…" : "Stake LP Tokens"}
            </button>
          )}
        </div>

        {/* Unstake */}
        <div className="stake-form-card">
          <h4 className="stake-form-title">🔓 Unstake LP Tokens</h4>
          <p className="stake-form-note">
            Withdraw LP tokens at any time. Pending rewards are preserved.
          </p>
          <div className="form-group">
            <label>Amount to Unstake</label>
            <div className="token-input-row">
              <input
                type="number"
                placeholder="0.0"
                min="0"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline max-btn"
                onClick={() => setUnstakeAmount(formatEther(stakedBal))}
              >
                MAX
              </button>
            </div>
            <small className="cost-hint">
              Staked: {fmt(stakedBal)} LP
            </small>
          </div>

          <button
            type="button"
            className="btn btn-outline step-btn"
            onClick={handleUnstake}
            disabled={loading || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || stakedBal === 0n}
          >
            {loading ? "Unstaking…" : "Unstake LP Tokens"}
          </button>
        </div>
      </div>
    </div>
  );
}
