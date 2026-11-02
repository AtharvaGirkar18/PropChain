import React, { useState, useEffect, useCallback } from "react";
import { Contract, parseEther, formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";
import MOCK_USDC_ABI      from "../abis/MockUSDC.json";

/**
 * InvestPanel
 * Lets a connected user buy fractional PropertyTokens using mUSDC.
 *
 * Flow:
 *  1. User enters how many tokens to buy
 *  2. Component quotes the mUSDC cost
 *  3. Step 1 — Approve mUSDC spending
 *  4. Step 2 — Call buyTokens()
 */
export default function InvestPanel({
  propertyTokenAddress,
  mockUSDCAddress,
  tokenSymbol = "PROP-1",
  onSuccess,
  onError,
}) {
  const { signer, account, isConnected } = useWallet();

  const [tokenAmount,    setTokenAmount]    = useState("");
  const [usdcCost,       setUsdcCost]       = useState(null);   // formatted string
  const [tokenPrice,     setTokenPrice]     = useState(null);   // formatted string (per token)
  const [available,      setAvailable]      = useState(null);   // formatted string
  const [myTokenBal,     setMyTokenBal]     = useState(null);   // formatted string
  const [myUSDCBal,      setMyUSDCBal]      = useState(null);   // formatted string
  const [pendingRent,    setPendingRent]    = useState(null);   // formatted string

  const [step,           setStep]           = useState(0);      // 0=idle 1=approving 2=buying
  const [loading,        setLoading]        = useState(false);

  const ready = isConnected && hasAddr(propertyTokenAddress) && hasAddr(mockUSDCAddress);

  // ── Fetch on-chain state ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!ready || !signer) return;
    try {
      const pt   = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const usdc = new Contract(mockUSDCAddress,      MOCK_USDC_ABI.abi,      signer);

      const [price, avail, myTok, myUSDC, pending] = await Promise.all([
        pt.tokenPrice(),
        pt.availableForSale(),
        pt.balanceOf(account),
        usdc.balanceOf(account),
        pt.pendingRentOf(account),
      ]);

      setTokenPrice(fmt6(price));           // price is mUSDC/token (6 dec)
      setAvailable(formatEther(avail));     // tokens (18 dec)
      setMyTokenBal(formatEther(myTok));
      setMyUSDCBal(fmt6(myUSDC));
      setPendingRent(fmt6(pending));
    } catch (err) {
      console.error("InvestPanel refresh error:", err);
    }
  }, [ready, signer, account, propertyTokenAddress, mockUSDCAddress]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Quote cost on input change ────────────────────────────────────────────
  useEffect(() => {
    const calc = async () => {
      if (!tokenAmount || !ready || !signer) { setUsdcCost(null); return; }
      try {
        const pt   = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
        const raw  = await pt.quoteUSDC(parseEther(tokenAmount));
        setUsdcCost(fmt6(raw));
      } catch { setUsdcCost(null); }
    };
    calc();
  }, [tokenAmount, ready, signer, propertyTokenAddress]);

  // ── Step 1: Approve mUSDC ─────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!ready) return;
    setLoading(true); setStep(1);
    try {
      const usdc  = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);
      const pt    = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const cost  = await pt.quoteUSDC(parseEther(tokenAmount));
      const tx    = await usdc.approve(propertyTokenAddress, cost);
      await tx.wait();
      setStep(2);
      onSuccess?.("✅ mUSDC approved. Now click Buy Tokens.");
    } catch (err) {
      onError?.(err.shortMessage || err.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Buy tokens ────────────────────────────────────────────────────
  const handleBuy = async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const pt = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const tx = await pt.buyTokens(parseEther(tokenAmount));
      await tx.wait();
      setTokenAmount("");
      setStep(0);
      await refresh();
      onSuccess?.(`✅ Purchased ${tokenAmount} ${tokenSymbol} tokens!`);
    } catch (err) {
      onError?.(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Claim rent ────────────────────────────────────────────────────────────
  const handleClaimRent = async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const pt = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const tx = await pt.claimRent();
      await tx.wait();
      await refresh();
      onSuccess?.("✅ Rental income claimed!");
    } catch (err) {
      onError?.(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isConnected) return (
    <div className="alert alert-warning">Connect your wallet to invest.</div>
  );

  if (!hasAddr(propertyTokenAddress)) return (
    <div className="alert alert-warning">
      PropertyToken address not configured for this network.
    </div>
  );

  return (
    <div className="invest-panel">
      {/* ── Stats row ── */}
      <div className="invest-stats">
        <div className="invest-stat">
          <span className="invest-stat-label">Token Price</span>
          <span className="invest-stat-value">{tokenPrice ?? "…"} mUSDC</span>
        </div>
        <div className="invest-stat">
          <span className="invest-stat-label">Available</span>
          <span className="invest-stat-value">{available ? Number(available).toLocaleString() : "…"} {tokenSymbol}</span>
        </div>
        <div className="invest-stat">
          <span className="invest-stat-label">Your PROP-1</span>
          <span className="invest-stat-value">{myTokenBal ? Number(myTokenBal).toLocaleString() : "…"} {tokenSymbol}</span>
        </div>
        <div className="invest-stat">
          <span className="invest-stat-label">Your mUSDC</span>
          <span className="invest-stat-value">{myUSDCBal ?? "…"}</span>
        </div>
      </div>

      {/* ── Buy form ── */}
      <div className="invest-form">
        <div className="form-group">
          <label>Tokens to buy</label>
          <div className="token-input-row">
            <input
              type="number"
              min="1"
              placeholder="e.g. 10"
              value={tokenAmount}
              onChange={e => { setTokenAmount(e.target.value); setStep(0); }}
            />
            <button
              className="btn btn-secondary max-btn"
              onClick={() => setTokenAmount(available ? Math.floor(Number(available)).toString() : "")}
            >
              MAX
            </button>
          </div>
          {usdcCost && (
            <small className="cost-hint">Cost: <strong>{usdcCost} mUSDC</strong></small>
          )}
        </div>

        <div className="two-step-flow">
          <button
            className={`btn ${step >= 1 ? "btn-secondary" : "btn-primary"} step-btn`}
            onClick={handleApprove}
            disabled={loading || !tokenAmount || step >= 2}
          >
            {step === 1 && loading ? "Approving…" : "① Approve mUSDC"}
          </button>
          <span className="step-arrow">→</span>
          <button
            className="btn btn-primary step-btn"
            onClick={handleBuy}
            disabled={loading || step < 2}
          >
            {step === 2 && loading ? "Buying…" : "② Buy Tokens"}
          </button>
        </div>
      </div>

      {/* ── Rental income ── */}
      {pendingRent && Number(pendingRent) > 0 && (
        <div className="rent-claim-row">
          <div>
            <p className="rent-label">Pending Rental Income</p>
            <p className="rent-value">{pendingRent} mUSDC</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleClaimRent}
            disabled={loading}
          >
            {loading ? "Claiming…" : "Claim Rent"}
          </button>
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

function fmt6(raw) {
  return (Number(raw) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
