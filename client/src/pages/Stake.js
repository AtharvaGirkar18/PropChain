import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Contract, formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";

import StakePanel    from "../components/StakePanel";
import RewardsClaim  from "../components/RewardsClaim";

import STAKING_ABI from "../abis/StakingRewards.json";
import DCE_ABI     from "../abis/DCEToken.json";
import LP_ABI      from "../abis/LiquidityPool.json";

const STAKE_TABS = [
  { id: "stake",   label: "🌾 Stake & Earn" },
  { id: "rewards", label: "💎 My Rewards"    },
  { id: "info",    label: "📘 How It Works"  },
];

export default function Stake() {
  const { signer, account, chainId, isConnected } = useWallet();

  const [activeTab, setActiveTab] = useState("stake");
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  // Header stats
  const [lpBal,     setLpBal]     = useState(null);
  const [stakedBal, setStakedBal] = useState(null);
  const [pendingDCE,setPendingDCE]= useState(null);
  const [dceBal,    setDceBal]    = useState(null);

  // Address override (in case contracts.js not yet updated after Remix deploy)
  const [customStakingAddr, setCustomStakingAddr] = useState(
    () => sessionStorage.getItem("decentraestate_staking_address") || ""
  );
  const [tempInput,    setTempInput]    = useState("");
  const [showAddrBox,  setShowAddrBox]  = useState(false);

  // Resolve from chain config
  const contracts = useMemo(() => (chainId ? getContractsForChain(chainId) : null), [chainId]);
  const defaultStakingAddr  = contracts?.stakingRewards || "";
  const dceTokenAddress     = contracts?.dceToken       || "";
  const lpTokenAddress      = contracts?.liquidityPool  || "";

  const effectiveStakingAddr = hasValidAddress(customStakingAddr)
    ? customStakingAddr
    : defaultStakingAddr;

  const isStakingReady = hasValidAddress(effectiveStakingAddr);
  const isDceReady     = hasValidAddress(dceTokenAddress);
  const isLpReady      = hasValidAddress(lpTokenAddress);
  const isFullyReady   = isStakingReady && isDceReady && isLpReady;

  // ── Header balances ──────────────────────────────────────────────────────
  const refreshHeader = useCallback(async () => {
    if (!signer || !account || !isFullyReady) return;
    try {
      const staking = new Contract(effectiveStakingAddr, STAKING_ABI.abi, signer);
      const dce     = new Contract(dceTokenAddress,      DCE_ABI.abi,     signer);
      const lp      = new Contract(lpTokenAddress,       LP_ABI.abi,      signer);

      const [lpBl, staked, pending, dceBl] = await Promise.all([
        lp.balanceOf(account).catch(() => 0n),
        staking.stakedBalance(account).catch(() => 0n),
        staking.earned(account).catch(() => 0n),
        dce.balanceOf(account).catch(() => 0n),
      ]);

      const formatLpVal = (b) => {
        if (!b || b === 0n) return "0.0000";
        const n = Number(formatEther(b));
        return n > 0 && n < 0.001 ? n.toFixed(6) : n.toFixed(4);
      };

      setLpBal(formatLpVal(lpBl));
      setStakedBal(formatLpVal(staked));
      setPendingDCE(Number(formatEther(pending)).toFixed(4));
      setDceBal(Number(formatEther(dceBl)).toFixed(4));
    } catch { /* silent */ }
  }, [signer, account, effectiveStakingAddr, dceTokenAddress, lpTokenAddress, isFullyReady]);

  useEffect(() => { refreshHeader(); }, [refreshHeader]);

  const pushSuccess = (msg) => {
    setSuccess(msg);
    setError("");
    refreshHeader();
    setTimeout(() => setSuccess(""), 4500);
  };

  const pushError = (msg) => {
    setError(msg);
    setSuccess("");
    setTimeout(() => setError(""), 6500);
  };

  // ── Custom address ────────────────────────────────────────────────────────
  const handleSaveAddr = () => {
    const trimmed = tempInput.trim();
    if (hasValidAddress(trimmed)) {
      setCustomStakingAddr(trimmed);
      sessionStorage.setItem("decentraestate_staking_address", trimmed);
      setShowAddrBox(false);
      pushSuccess("Staking contract address updated.");
    } else {
      pushError("Invalid address — must be a 42-character hex string.");
    }
  };

  const handleClearAddr = () => {
    setCustomStakingAddr("");
    sessionStorage.removeItem("decentraestate_staking_address");
    setShowAddrBox(false);
    pushSuccess("Reset to default network address.");
  };

  return (
    <section className="panel">
      {/* ── Page Header ── */}
      <div className="stake-page-header">
        <div>
          <h2>Yield Farming &amp; Staking</h2>
          <p className="panel-note">
            Stake LP tokens · Earn DCE governance tokens · Claim anytime
          </p>
        </div>
        <div className="trade-badge-group">
          <span className="badge-chain">{contracts?.name || "Sepolia Testnet"}</span>
        </div>
      </div>

      {/* ── Not connected ── */}
      {!isConnected && (
        <div className="alert alert-warning">
          Connect your wallet to start farming DCE rewards.
        </div>
      )}

      {/* ── Staking contract not configured ── */}
      {isConnected && !isStakingReady && (
        <div className="stake-deploy-box">
          <div className="stake-deploy-header">
            <h4>Deploy StakingRewards on Sepolia</h4>
            <span className="remix-step-tag">Setup Required</span>
          </div>
          <p className="remix-desc">
            Compile <code>contracts/DCEToken.sol</code> and <code>contracts/StakingRewards.sol</code> in Remix, then:
          </p>
          <ol className="deploy-steps">
            <li>Deploy <strong>DCEToken</strong> (no constructor args)</li>
            <li>Deploy <strong>StakingRewards</strong> with: <code>lpToken</code> = LiquidityPool address, <code>dceToken</code> = DCEToken address, <code>rewardRate</code> = <code>1000000000000000</code> (1e15)</li>
            <li>Call <code>DCEToken.setMinter(stakingRewardsAddress)</code></li>
            <li>Update <code>contracts.js</code> with both addresses</li>
          </ol>
          <div className="remix-input-row" style={{ marginTop: "0.8rem" }}>
            <input
              type="text"
              placeholder="Or paste StakingRewards address here (0x…)"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveAddr}
            >
              Connect
            </button>
          </div>
        </div>
      )}

      {/* ── Active contract bar ── */}
      {isConnected && isStakingReady && (
        <div className="pool-address-bar">
          <div className="pool-addr-info">
            <span className="addr-tag">StakingRewards:</span>
            <code className="addr-code">{effectiveStakingAddr}</code>
            {customStakingAddr && <span className="override-pill">Session</span>}
          </div>
          <div className="pool-addr-actions">
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => {
                setTempInput(effectiveStakingAddr);
                setShowAddrBox(!showAddrBox);
              }}
            >
              {showAddrBox ? "Cancel" : "Change"}
            </button>
            {customStakingAddr && (
              <button type="button" className="btn btn-outline btn-xs" onClick={handleClearAddr}>
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {showAddrBox && (
        <div className="address-edit-box">
          <input
            type="text"
            placeholder="0x…"
            value={tempInput}
            onChange={(e) => setTempInput(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAddr}>
            Save
          </button>
        </div>
      )}

      {/* ── Feedback ── */}
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Header Stats (when ready) ── */}
      {isConnected && isFullyReady && (
        <div className="stake-header-stats">
          <div className="hstat">
            <span className="hstat-label">LP Balance</span>
            <span className="hstat-value">{lpBal ?? "…"} LP</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">LP Staked</span>
            <span className="hstat-value text-accent">{stakedBal ?? "…"} LP</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">Pending DCE</span>
            <span className="hstat-value glow-green-sm">{pendingDCE ?? "…"} DCE</span>
          </div>
          <div className="hstat">
            <span className="hstat-label">DCE in Wallet</span>
            <span className="hstat-value">{dceBal ?? "…"} DCE</span>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="trade-nav-tabs" style={{ marginTop: "1.4rem" }}>
        {STAKE_TABS.map((tab) => (
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

      {/* ── Tab: Stake ── */}
      {activeTab === "stake" && (
        <div className="trade-tab-content">
          {isConnected && isFullyReady ? (
            <StakePanel
              stakingAddress={effectiveStakingAddr}
              lpTokenAddress={lpTokenAddress}
              onSuccess={pushSuccess}
              onError={pushError}
              onRefresh={refreshHeader}
            />
          ) : (
            <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
              <p>Connect wallet and configure contracts above to start staking.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Rewards ── */}
      {activeTab === "rewards" && (
        <div className="trade-tab-content">
          {isConnected && isFullyReady ? (
            <RewardsClaim
              stakingAddress={effectiveStakingAddr}
              dceTokenAddress={dceTokenAddress}
              onSuccess={pushSuccess}
              onError={pushError}
              onRefresh={refreshHeader}
            />
          ) : (
            <div className="empty-state" style={{ textAlign: "center", padding: "2rem" }}>
              <p>Connect wallet and configure contracts above to see rewards.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Info ── */}
      {activeTab === "info" && (
        <div className="trade-tab-content">
          <div className="amm-explainer-card">
            <h3>Synthetix-Pattern Yield Farming</h3>
            <p>
              This staking contract implements the battle-tested reward accounting
              model pioneered by Synthetix, used by virtually every major DeFi yield farm.
            </p>

            <div className="amm-formula-banner">
              <code>rewardPerToken = Σ (rewardRate × Δt) / totalStaked</code>
              <p>
                Rewards accumulate every second. Each user's share is calculated
                lazily on interaction — <strong>no loops, constant gas cost</strong>.
              </p>
            </div>

            <div className="amm-features-grid">
              <div className="feature-card">
                <h4>🌾 LP Token Staking</h4>
                <p>
                  Stake the LP tokens you receive from the AMM Liquidity Pool.
                  This creates a dual-incentive: LP fees from trading <em>plus</em> DCE farming rewards.
                </p>
              </div>

              <div className="feature-card">
                <h4>💎 DCE Token</h4>
                <p>
                  DCE (DecentraEstate Token) is the platform's governance and reward token.
                  It is minted exclusively by this staking contract — no pre-mine, no team allocation.
                </p>
              </div>

              <div className="feature-card">
                <h4>⚡ Claim Anytime</h4>
                <p>
                  There are no lock-up periods. Unstake LP and claim DCE whenever you wish.
                  Use <strong>Exit</strong> to do both in a single transaction, saving gas.
                </p>
              </div>

              <div className="feature-card">
                <h4>📐 Per-Second Precision</h4>
                <p>
                  Rewards are calculated with 18-decimal precision.
                  <code>rewardRate</code> is set in DCE per second per total staked,
                  adjusted by the owner via <code>setRewardRate()</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
