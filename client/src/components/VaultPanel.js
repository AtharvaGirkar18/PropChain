import React, { useState, useEffect, useCallback } from "react";
import { Contract, parseEther, formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import PROPERTY_VAULT_ABI from "../abis/PropertyVault.json";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";

/**
 * VaultPanel
 * Full ERC-4626 vault interface:
 *  - Deposit tab: PropertyToken → vault shares
 *  - Redeem tab:  vault shares → PropertyTokens
 *  - Stats: TVL, your shares, redeemable value, APY, share price
 *
 * Admin-only section: notifyYield (adds tokens as simulated yield).
 */
export default function VaultPanel({
  propertyVaultAddress,
  propertyTokenAddress,
  onSuccess,
  onError,
}) {
  const { signer, account, isConnected } = useWallet();

  const [tab,            setTab]           = useState("deposit");
  const [amount,         setAmount]        = useState("");

  // Vault stats
  const [tvl,            setTvl]           = useState(null);
  const [myShares,       setMyShares]      = useState(null);
  const [redeemable,     setRedeemable]    = useState(null);
  const [apy,            setApy]           = useState(null);
  const [sharePrice,     setSharePrice]    = useState(null);
  const [myTokenBal,     setMyTokenBal]    = useState(null);
  const [vaultOwner,     setVaultOwner]    = useState(null);

  // Preview
  const [preview,        setPreview]       = useState(null);

  const [step,           setStep]          = useState(0);       // 0=idle 1=approved
  const [loading,        setLoading]       = useState(false);

  const ready = isConnected && hasAddr(propertyVaultAddress) && hasAddr(propertyTokenAddress);

  // ── Fetch vault state ─────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!ready || !signer || !account) return;
    try {
      const vault = new Contract(propertyVaultAddress, PROPERTY_VAULT_ABI.abi, signer);
      const pt    = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);

      const [
        totalAssets,
        shares,
        sp,
        apyVal,
        myTok,
        owner,
      ] = await Promise.all([
        vault.totalAssets(),
        vault.balanceOf(account),
        vault.sharePrice(),
        vault.estimatedAPY(),
        pt.balanceOf(account),
        vault.owner(),
      ]);

      const redeemAssets = shares > 0n ? await vault.previewRedeem(shares) : 0n;

      setTvl(formatEther(totalAssets));
      setMyShares(formatEther(shares));
      setRedeemable(formatEther(redeemAssets));
      setApy(apyVal.toString());
      setSharePrice(formatEther(sp));
      setMyTokenBal(formatEther(myTok));
      setVaultOwner(owner.toLowerCase());
    } catch (err) {
      console.error("VaultPanel refresh error:", err);
    }
  }, [ready, signer, account, propertyVaultAddress, propertyTokenAddress]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Preview on amount change ──────────────────────────────────────────────
  useEffect(() => {
    const calc = async () => {
      if (!amount || !ready || !signer) { setPreview(null); return; }
      try {
        const vault = new Contract(propertyVaultAddress, PROPERTY_VAULT_ABI.abi, signer);
        const raw   = tab === "deposit"
          ? await vault.previewDeposit(parseEther(amount))
          : await vault.previewRedeem(parseEther(amount));
        setPreview(formatEther(raw));
      } catch { setPreview(null); }
    };
    calc();
  }, [amount, tab, ready, signer, propertyVaultAddress]);

  // ── Step 1: Approve vault to spend PropertyTokens ─────────────────────────
  const handleApprove = async () => {
    setLoading(true); setStep(1);
    try {
      const pt = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const tx = await pt.approve(propertyVaultAddress, parseEther(amount));
      await tx.wait();
      setStep(2);
      onSuccess?.("✅ PropertyToken approved. Now click Deposit.");
    } catch (err) {
      onError?.(err.shortMessage || err.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Deposit ───────────────────────────────────────────────────────
  const handleDeposit = async () => {
    setLoading(true);
    try {
      const vault = new Contract(propertyVaultAddress, PROPERTY_VAULT_ABI.abi, signer);
      const tx    = await vault.deposit(parseEther(amount), account);
      await tx.wait();
      setAmount(""); setStep(0);
      await refresh();
      onSuccess?.("✅ Tokens deposited into vault!");
    } catch (err) {
      onError?.(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Redeem shares ─────────────────────────────────────────────────────────
  const handleRedeem = async () => {
    setLoading(true);
    try {
      const vault = new Contract(propertyVaultAddress, PROPERTY_VAULT_ABI.abi, signer);
      const tx    = await vault.redeem(parseEther(amount), account, account);
      await tx.wait();
      setAmount(""); setStep(0);
      await refresh();
      onSuccess?.("✅ Shares redeemed for PropertyTokens!");
    } catch (err) {
      onError?.(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Admin: Notify yield ───────────────────────────────────────────────────
  const [yieldAmount, setYieldAmount] = useState("");
  const handleNotifyYield = async () => {
    setLoading(true);
    try {
      const pt    = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const vault = new Contract(propertyVaultAddress, PROPERTY_VAULT_ABI.abi, signer);
      // Approve first
      const approveTx = await pt.approve(propertyVaultAddress, parseEther(yieldAmount));
      await approveTx.wait();
      // Notify
      const tx = await vault.notifyYield(parseEther(yieldAmount));
      await tx.wait();
      setYieldAmount("");
      await refresh();
      onSuccess?.(`✅ ${yieldAmount} PROP-1 yield notified to vault!`);
    } catch (err) {
      onError?.(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isConnected) return (
    <div className="alert alert-warning">Connect wallet to use the vault.</div>
  );
  if (!hasAddr(propertyVaultAddress)) return (
    <div className="alert alert-warning">
      PropertyVault address not configured for this network.
    </div>
  );

  const isAdmin = vaultOwner && account?.toLowerCase() === vaultOwner;

  return (
    <div className="vault-panel">
      {/* ── Stats ── */}
      <div className="vault-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Value Locked</span>
          <span className="stat-value">{tvl ? Number(tvl).toLocaleString() : "…"}</span>
          <span className="stat-unit">PROP-1</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Your Shares</span>
          <span className="stat-value">{myShares ? Number(myShares).toLocaleString() : "…"}</span>
          <span className="stat-unit">deVAULT</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Redeemable Value</span>
          <span className="stat-value">{redeemable ? Number(redeemable).toLocaleString() : "…"}</span>
          <span className="stat-unit">PROP-1</span>
        </div>
        <div className="stat-card stat-card-accent">
          <span className="stat-label">Est. APY</span>
          <span className="stat-value apy-value">{apy ?? "—"}{apy !== null ? "%" : ""}</span>
          <span className="stat-unit">Share Price: {sharePrice ? Number(sharePrice).toFixed(4) : "—"}</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="inline-tabs" style={{ marginTop: "1.2rem" }}>
        {["deposit", "redeem"].map(t => (
          <button
            key={t}
            className={`tab-button ${tab === t ? "active" : ""}`}
            onClick={() => { setTab(t); setAmount(""); setStep(0); setPreview(null); }}
          >
            {t === "deposit" ? "⬇ Deposit" : "⬆ Redeem"}
          </button>
        ))}
      </div>

      {/* ── Deposit ── */}
      {tab === "deposit" && (
        <div className="vault-form">
          <div className="form-group">
            <label>PROP-1 to deposit</label>
            <div className="token-input-row">
              <input
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={amount}
                onChange={e => { setAmount(e.target.value); setStep(0); }}
              />
              <button
                className="btn btn-secondary max-btn"
                onClick={() => setAmount(myTokenBal ? Math.floor(Number(myTokenBal)).toString() : "")}
              >
                MAX
              </button>
            </div>
            {preview && (
              <small className="cost-hint">
                You will receive ≈ <strong>{Number(preview).toFixed(4)} deVAULT</strong> shares
              </small>
            )}
          </div>

          <div className="two-step-flow">
            <button
              className={`btn ${step >= 2 ? "btn-secondary" : "btn-primary"} step-btn`}
              onClick={handleApprove}
              disabled={loading || !amount || step >= 2}
            >
              {step === 1 && loading ? "Approving…" : "① Approve"}
            </button>
            <span className="step-arrow">→</span>
            <button
              className="btn btn-primary step-btn"
              onClick={handleDeposit}
              disabled={loading || step < 2}
            >
              {step === 2 && loading ? "Depositing…" : "② Deposit"}
            </button>
          </div>
        </div>
      )}

      {/* ── Redeem ── */}
      {tab === "redeem" && (
        <div className="vault-form">
          <div className="form-group">
            <label>deVAULT shares to redeem</label>
            <div className="token-input-row">
              <input
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <button
                className="btn btn-secondary max-btn"
                onClick={() => setAmount(myShares ? Math.floor(Number(myShares)).toString() : "")}
              >
                MAX
              </button>
            </div>
            {preview && (
              <small className="cost-hint">
                You will receive ≈ <strong>{Number(preview).toFixed(4)} PROP-1</strong>
              </small>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleRedeem}
            disabled={loading || !amount}
            style={{ width: "100%" }}
          >
            {loading ? "Redeeming…" : "Redeem Shares"}
          </button>
        </div>
      )}

      {/* ── Admin: Notify Yield ── */}
      {isAdmin && (
        <div className="admin-yield-box">
          <h4>⚙ Admin — Notify Yield</h4>
          <p className="panel-note">
            Transfer PropertyTokens into the vault as simulated rental yield.
            This increases the value of every share.
          </p>
          <div className="token-input-row">
            <input
              type="number"
              min="0"
              placeholder="PROP-1 yield amount"
              value={yieldAmount}
              onChange={e => setYieldAmount(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleNotifyYield}
              disabled={loading || !yieldAmount}
            >
              {loading ? "Sending…" : "Notify Yield"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function hasAddr(addr) {
  return (
    typeof addr === "string" &&
    addr.length === 42 &&
    addr !== "0x0000000000000000000000000000000000000000"
  );
}
