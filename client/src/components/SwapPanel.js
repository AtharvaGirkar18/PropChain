/* global BigInt */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Contract,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
} from "ethers";
import { useWallet } from "../context/WalletContext";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";
import MOCK_USDC_ABI from "../abis/MockUSDC.json";
import DCE_TOKEN_ABI from "../abis/DCEToken.json";
import DEX_ROUTER_ABI from "../abis/DEXRouter.json";
import LIQUIDITY_POOL_ABI from "../abis/LiquidityPool.json";

/**
 * SwapPanel — Experiment 6: Multi-Pool DEX Prototype
 *
 * Supported tokens: PROP · mUSDC · DCE
 * Supported paths:
 *   PROP  ↔ mUSDC  — single hop (Pool 1: PROP/mUSDC)
 *   DCE   ↔ mUSDC  — single hop (Pool 2: DCE/mUSDC)
 *   PROP  ↔ DCE    — two-hop via mUSDC (Pool 1 + Pool 2)
 *
 * Routes through DEXRouter.swapExactTokensForTokens with:
 *   - On-chain deadline enforcement
 *   - On-chain slippage guard (amountOutMin)
 * Falls back to direct LiquidityPool.swap() if router not deployed.
 */

// ── Token definitions ────────────────────────────────────────────────────────
const buildTokens = (propAddr, usdcAddr, dceAddr) => ({
  PROP:  { symbol: "PROP",  decimals: 18, address: propAddr,  abi: PROPERTY_TOKEN_ABI.abi },
  mUSDC: { symbol: "mUSDC", decimals: 6,  address: usdcAddr,  abi: MOCK_USDC_ABI.abi     },
  DCE:   { symbol: "DCE",   decimals: 18, address: dceAddr,   abi: DCE_TOKEN_ABI.abi     },
});

const TOKEN_SYMBOLS = ["PROP", "mUSDC", "DCE"];

// Determine the routing path between two tokens
function buildPath(fromSym, toSym, tokens) {
  if (fromSym === toSym) return null;
  const addr = (s) => tokens[s].address;
  // Direct pairs
  if (
    (fromSym === "PROP"  && toSym === "mUSDC") ||
    (fromSym === "mUSDC" && toSym === "PROP")  ||
    (fromSym === "DCE"   && toSym === "mUSDC") ||
    (fromSym === "mUSDC" && toSym === "DCE")
  ) {
    return [addr(fromSym), addr(toSym)];
  }
  // Multi-hop via mUSDC
  if (
    (fromSym === "PROP" && toSym === "DCE") ||
    (fromSym === "DCE"  && toSym === "PROP")
  ) {
    return [addr(fromSym), addr("mUSDC"), addr(toSym)];
  }
  return null;
}

// Human-readable route label
function routeLabel(fromSym, toSym) {
  if (
    (fromSym === "PROP" && toSym === "DCE") ||
    (fromSym === "DCE"  && toSym === "PROP")
  ) {
    return `${fromSym} → mUSDC → ${toSym}`;
  }
  return `${fromSym} → ${toSym}`;
}

export default function SwapPanel({
  routerAddress,
  poolAddress,         // PROP/mUSDC pool (Exp 4)
  propertyTokenAddress,
  mockUSDCAddress,
  dceTokenAddress,
  dcePoolAddress,
  poolData,            // reserves of PROP/mUSDC pool from Trade.js
  onSuccess,
  onError,
  onRefresh,
}) {
  const { signer, account, isConnected } = useWallet();

  const [fromSym, setFromSym] = useState("mUSDC");
  const [toSym,   setToSym]   = useState("PROP");

  const [inputAmount,  setInputAmount]  = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippage,     setSlippage]     = useState("0.5");
  const [deadlineMin,  setDeadlineMin]  = useState("20");

  const [balances,   setBalances]   = useState({ PROP: 0n, mUSDC: 0n, DCE: 0n });
  const [allowances, setAllowances] = useState({ PROP: 0n, mUSDC: 0n, DCE: 0n });

  const [loading,    setLoading]    = useState(false);
  const [actionStep, setActionStep] = useState("idle");

  const isRouterReady =
    routerAddress &&
    routerAddress !== "0x0000000000000000000000000000000000000000";

  const hasDCEPool =
    isRouterReady &&
    dceTokenAddress &&
    dceTokenAddress !== "0x0000000000000000000000000000000000000000" &&
    dcePoolAddress &&
    dcePoolAddress !== "0x0000000000000000000000000000000000000000";

  const tokens = useMemo(
    () => buildTokens(propertyTokenAddress, mockUSDCAddress, dceTokenAddress),
    [propertyTokenAddress, mockUSDCAddress, dceTokenAddress]
  );

  const path = useMemo(() => buildPath(fromSym, toSym, tokens), [fromSym, toSym, tokens]);
  const isMultiHop = path?.length === 3;

  const { reserveA = 0n, reserveB = 0n } = poolData || {};
  const isPoolEmpty = reserveA === 0n || reserveB === 0n;

  const spenderAddress = isRouterReady ? routerAddress : poolAddress;

  // ── Fetch balances & allowances ────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!signer || !account) return;
    try {
      const entries = await Promise.all(
        TOKEN_SYMBOLS.map(async (sym) => {
          const { address, abi } = tokens[sym];
          if (!address || address === "0x0000000000000000000000000000000000000000") {
            return { sym, bal: 0n, allow: 0n };
          }
          const c = new Contract(address, abi, signer);
          const [bal, allow] = await Promise.all([
            c.balanceOf(account).catch(() => 0n),
            spenderAddress
              ? c.allowance(account, spenderAddress).catch(() => 0n)
              : Promise.resolve(0n),
          ]);
          return { sym, bal, allow };
        })
      );
      const newBal   = {};
      const newAllow = {};
      entries.forEach(({ sym, bal, allow }) => {
        newBal[sym]   = bal;
        newAllow[sym] = allow;
      });
      setBalances(newBal);
      setAllowances(newAllow);
    } catch (err) {
      console.error("fetchBalances error:", err);
    }
  }, [signer, account, tokens, spenderAddress]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 5000);
    return () => clearInterval(interval);
  }, [fetchBalances, poolData]);

  // ── Quote — call router.getAmountsOut (async) ──────────────────────────────
  const fetchQuote = useCallback(async (amtIn) => {
    if (!amtIn || !path || !signer) return "";
    try {
      const fromToken = tokens[fromSym];
      const parsedIn = parseUnits(amtIn, fromToken.decimals);
      if (parsedIn === 0n) return "";

      if (isRouterReady) {
        const router = new Contract(routerAddress, DEX_ROUTER_ABI.abi, signer);
        const amounts = await router.getAmountsOut(parsedIn, path);
        const toToken = tokens[toSym];
        return formatUnits(amounts[amounts.length - 1], toToken.decimals);
      } else {
        // Fallback: single-hop client-side calc using PROP/mUSDC reserves
        if (isMultiHop) return ""; // can't calculate multi-hop without router
        const isFromA = fromSym === "PROP";
        const resIn  = isFromA ? reserveA : reserveB;
        const resOut = isFromA ? reserveB : reserveA;
        if (resIn === 0n || resOut === 0n) return "";
        const amtInWithFee = parsedIn * 997n;
        const out = (amtInWithFee * resOut) / (resIn * 1000n + amtInWithFee);
        const toToken = tokens[toSym];
        return formatUnits(out, toToken.decimals);
      }
    } catch {
      return "";
    }
  }, [path, signer, tokens, fromSym, toSym, isRouterReady, routerAddress, isMultiHop, reserveA, reserveB]);

  const handleInputChange = async (val) => {
    setInputAmount(val);
    if (!val || isNaN(val) || Number(val) <= 0) {
      setOutputAmount("");
      return;
    }
    const quote = await fetchQuote(val);
    setOutputAmount(quote);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const fromToken = tokens[fromSym];
  const toToken   = tokens[toSym];

  let parsedIn  = 0n;
  let parsedOut = 0n;
  try {
    if (inputAmount  && Number(inputAmount)  > 0) parsedIn  = parseUnits(inputAmount,  fromToken.decimals);
    if (outputAmount && Number(outputAmount) > 0) parsedOut = parseUnits(outputAmount, toToken.decimals);
  } catch { /* ignore */ }

  const currentBalance  = balances[fromSym]   || 0n;
  const currentAllowance = allowances[fromSym] || 0n;
  const hasEnoughBalance = currentBalance >= parsedIn;
  const needsApproval    = parsedIn > 0n && currentAllowance < parsedIn;

  const slippageBps  = slippage === "2.0" ? 200n : slippage === "1.0" ? 100n : 50n;
  const minAmountOut = parsedOut > 0n
    ? (parsedOut * (10000n - slippageBps)) / 10000n
    : 0n;

  const getDeadline = () =>
    BigInt(Math.floor(Date.now() / 1000) + Number(deadlineMin) * 60);

  const formatBal = (sym) => {
    const b = balances[sym] || 0n;
    return Number(formatUnits(b, tokens[sym].decimals)).toFixed(
      tokens[sym].decimals === 6 ? 2 : 4
    );
  };

  // ── Flip tokens ────────────────────────────────────────────────────────────
  const handleFlip = () => {
    setFromSym(toSym);
    setToSym(fromSym);
    setInputAmount("");
    setOutputAmount("");
  };

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!signer || !spenderAddress) return;
    try {
      setLoading(true);
      setActionStep("approving");
      const token = new Contract(fromToken.address, fromToken.abi, signer);
      const tx = await token.approve(spenderAddress, parsedIn * 100n);
      await tx.wait();
      await fetchBalances();
      onSuccess(`${fromSym} approved for ${isRouterReady ? "DEX Router" : "Pool"}.`);
    } catch (err) {
      onError(err.reason || err.message || "Approval failed.");
    } finally {
      setLoading(false);
      setActionStep("idle");
    }
  };

  // ── Swap ───────────────────────────────────────────────────────────────────
  const handleSwap = async (e) => {
    e.preventDefault();
    if (!signer || !path) return;
    if (parsedIn === 0n) { onError("Enter a valid amount."); return; }
    if (!hasEnoughBalance) { onError("Insufficient balance."); return; }

    try {
      setLoading(true);
      setActionStep("swapping");
      const deadline = getDeadline();
      let receipt;

      if (isRouterReady) {
        const router = new Contract(routerAddress, DEX_ROUTER_ABI.abi, signer);
        const tx = await router.swapExactTokensForTokens(
          parsedIn,
          minAmountOut,
          path,
          account,
          deadline
        );
        receipt = await tx.wait();
      } else {
        // Fallback: direct single-hop pool swap (no multi-hop without router)
        if (isMultiHop) {
          onError("Multi-hop swaps require the DEX Router. Please deploy it first.");
          return;
        }
        const poolContract = new Contract(poolAddress, LIQUIDITY_POOL_ABI.abi, signer);
        const tx = await poolContract.swap(parsedIn, minAmountOut, fromToken.address, account);
        receipt = await tx.wait();
      }

      const label = isMultiHop ? `Multi-hop ${fromSym} → mUSDC → ${toSym}` : `${fromSym} → ${toSym}`;
      onSuccess(`${label} swap complete! Tx: ${receipt.hash.slice(0, 10)}...`);
      setInputAmount("");
      setOutputAmount("");
      await fetchBalances();
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg =
        err.message?.includes("DeadlineExpired")          ? "Transaction deadline expired. Try again." :
        err.message?.includes("InsufficientOutputAmount") ? "Slippage exceeded. Try increasing tolerance." :
        err.message?.includes("PoolNotFound")             ? "No pool found for this token pair." :
        err.reason || err.message || "Swap failed.";
      onError(msg);
    } finally {
      setLoading(false);
      setActionStep("idle");
    }
  };

  // ── Available toSym options (exclude fromSym) ──────────────────────────────
  const toOptions = TOKEN_SYMBOLS.filter((s) => {
    if (s === fromSym) return false;
    // Hide DCE if no DCE pool configured
    if ((s === "DCE" || fromSym === "DCE") && !hasDCEPool) return false;
    return true;
  });

  return (
    <div className="liquidity-action-card">
      {/* ── Header ── */}
      <div className="action-card-header">
        <h4>{isRouterReady ? "DEX Router Swap" : "Direct AMM Swap"}</h4>
        <span className="card-badge">
          {isRouterReady
            ? isMultiHop ? "🔀 Multi-Hop · 2 Pools" : "🔀 DEXRouter · Exp 6"
            : "⚡ Direct Pool · Exp 4"}
        </span>
      </div>

      <p className="card-desc">
        {isRouterReady
          ? `Route: ${routeLabel(fromSym, toSym)} — on-chain deadline & slippage enforced by DEXRouter.`
          : "Router not yet deployed — trading directly against the AMM pool (Exp 4 compatibility mode)."}
      </p>

      {/* ── Router status pill ── */}
      <div className="router-status-row">
        <span className={`router-pill ${isRouterReady ? "router-active" : "router-fallback"}`}>
          {isRouterReady
            ? `🟢 Router: ${routerAddress.slice(0, 8)}...${routerAddress.slice(-6)}`
            : "🟡 Fallback: Direct pool swap (deploy DEXRouter to upgrade)"}
        </span>
        {isMultiHop && (
          <span className="router-pill router-active" style={{ marginLeft: "0.5rem" }}>
            ⛓️ 2-hop via mUSDC
          </span>
        )}
      </div>

      {isPoolEmpty && (fromSym === "PROP" || toSym === "PROP") && (
        <div className="pool-alert-empty">
          <span>⚠️</span>
          <div>PROP/mUSDC pool is empty. Supply liquidity first in the Liquidity tab.</div>
        </div>
      )}

      <form onSubmit={handleSwap} className="liquidity-form">

        {/* ── Token In ── */}
        <div className="form-group">
          <div className="input-label-row">
            <label>You Pay</label>
            <span className="balance-hint">Balance: {formatBal(fromSym)} {fromSym}</span>
          </div>
          <div className="token-input-row">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={loading}
              required
            />
            <select
              className="token-select"
              value={fromSym}
              onChange={(e) => {
                setFromSym(e.target.value);
                if (e.target.value === toSym) setToSym(TOKEN_SYMBOLS.find(s => s !== e.target.value));
                setInputAmount("");
                setOutputAmount("");
              }}
            >
              {TOKEN_SYMBOLS.filter(s => !(s === "DCE" && !hasDCEPool)).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline max-btn"
              onClick={() => handleInputChange(formatUnits(currentBalance, fromToken.decimals))}
              disabled={loading}
            >MAX</button>
          </div>
          {!hasEnoughBalance && parsedIn > 0n && (
            <span className="error-hint">Insufficient {fromSym} balance</span>
          )}
        </div>

        {/* ── Flip ── */}
        <div className="swap-flip-container">
          <button type="button" className="swap-flip-btn" onClick={handleFlip} disabled={loading} title="Flip tokens">
            ⇅
          </button>
        </div>

        {/* ── Token Out ── */}
        <div className="form-group">
          <div className="input-label-row">
            <label>You Receive (Estimated)</label>
            <span className="balance-hint">Balance: {formatBal(toSym)} {toSym}</span>
          </div>
          <div className="token-input-row">
            <input
              type="text"
              readOnly
              placeholder="0.0"
              value={outputAmount ? Number(outputAmount).toFixed(6) : ""}
              className="readonly-input"
            />
            <select
              className="token-select"
              value={toSym}
              onChange={(e) => {
                setToSym(e.target.value);
                setInputAmount("");
                setOutputAmount("");
              }}
            >
              {toOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Route display ── */}
        {path && (
          <div className="route-display">
            <span className="route-label">Route:</span>
            <span className="route-path">
              {path.length === 2
                ? `${fromSym} → ${toSym} (1 pool)`
                : `${fromSym} → mUSDC → ${toSym} (2 pools)`}
            </span>
          </div>
        )}

        {/* ── Swap details ── */}
        {parsedOut > 0n && (
          <div className="expected-lp-box">
            {/* Slippage */}
            <div className="expected-lp-row">
              <span>Slippage Tolerance:</span>
              <div className="slippage-options">
                {["0.5", "1.0", "2.0"].map(s => (
                  <button key={s} type="button"
                    className={`slippage-pill ${slippage === s ? "active" : ""}`}
                    onClick={() => setSlippage(s)}>{s}%</button>
                ))}
              </div>
            </div>

            {/* Deadline */}
            {isRouterReady && (
              <div className="expected-lp-row" style={{ marginTop: "0.4rem" }}>
                <span>Deadline:</span>
                <div className="slippage-options">
                  {["10", "20", "30"].map(m => (
                    <button key={m} type="button"
                      className={`slippage-pill ${deadlineMin === m ? "active" : ""}`}
                      onClick={() => setDeadlineMin(m)}>{m} min</button>
                  ))}
                </div>
              </div>
            )}

            {/* Min received */}
            <div className="expected-lp-row" style={{ marginTop: "0.4rem" }}>
              <span>Minimum Received:</span>
              <strong className="text-accent">
                {Number(formatUnits(minAmountOut, toToken.decimals)).toFixed(6)} {toSym}
              </strong>
            </div>

            {/* LP Fee note */}
            <div className="expected-lp-row" style={{ marginTop: "0.2rem", fontSize: "0.8rem", color: "var(--text-soft)" }}>
              <span>Fee:</span>
              <span>{isMultiHop ? "0.3% × 2 hops" : "0.3% (LP fee)"}</span>
            </div>
          </div>
        )}

        {/* ── Buttons ── */}
        <div className="deposit-action-steps">
          {needsApproval && (
            <button type="button" className="btn btn-warning step-btn"
              onClick={handleApprove}
              disabled={loading || !hasEnoughBalance || parsedIn === 0n}>
              {actionStep === "approving" ? "Approving..." : `Approve ${fromSym}`}
            </button>
          )}
          <button type="submit" className="btn btn-primary step-btn"
            disabled={loading || needsApproval || parsedIn === 0n || !isConnected || (!isRouterReady && isMultiHop)}>
            {actionStep === "swapping" ? "Swapping..."
              : needsApproval             ? "Approve First"
              : !isRouterReady && isMultiHop ? "Deploy Router for Multi-Hop"
              : isRouterReady             ? `Swap via Router`
              : "Swap Tokens"}
          </button>
        </div>
      </form>
    </div>
  );
}
