import React, { useState, useEffect, useCallback } from "react";
import { Contract, parseEther, parseUnits, formatEther, formatUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import PROPERTY_TOKEN_ABI from "../abis/PropertyToken.json";
import MOCK_USDC_ABI from "../abis/MockUSDC.json";
import LIQUIDITY_POOL_ABI from "../abis/LiquidityPool.json";

/**
 * AddLiquidity
 * Form to deposit PROP and mUSDC pairs into the LiquidityPool contract.
 * Automatically aligns with current pool ratio when reserves exist,
 * and handles multi-step ERC-20 approvals before adding liquidity.
 *
 * Experiment 4 — AMM Liquidity Pool
 */
export default function AddLiquidity({
  poolAddress,
  propertyTokenAddress,
  mockUSDCAddress,
  poolData,
  onSuccess,
  onError,
  onRefresh,
}) {
  const { signer, account, isConnected } = useWallet();

  const [propInput, setPropInput] = useState("");
  const [usdcInput, setUsdcInput] = useState("");

  const [propBalance, setPropBalance] = useState(0n);
  const [usdcBalance, setUsdcBalance] = useState(0n);

  const [propAllowance, setPropAllowance] = useState(0n);
  const [usdcAllowance, setUsdcAllowance] = useState(0n);

  const [activeStep, setActiveStep] = useState("idle"); // idle | approvingProp | approvingUsdc | adding
  const [actionLoading, setActionLoading] = useState(false);

  const { reserveA = 0n, reserveB = 0n, totalSupply = 0n } = poolData || {};
  const isInitialPool = reserveA === 0n || reserveB === 0n;

  // ── Fetch user token balances & allowances ────────────────────────────────
  const fetchBalancesAndAllowances = useCallback(async () => {
    if (!signer || !account || !propertyTokenAddress || !mockUSDCAddress || !poolAddress) return;
    try {
      const propContract = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      const usdcContract = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);

      const [pBal, uBal, pAllow, uAllow] = await Promise.all([
        propContract.balanceOf(account),
        usdcContract.balanceOf(account),
        propContract.allowance(account, poolAddress),
        usdcContract.allowance(account, poolAddress),
      ]);

      setPropBalance(pBal);
      setUsdcBalance(uBal);
      setPropAllowance(pAllow);
      setUsdcAllowance(uAllow);
    } catch (err) {
      console.error("Error fetching balances or allowances:", err);
    }
  }, [signer, account, propertyTokenAddress, mockUSDCAddress, poolAddress]);

  useEffect(() => {
    fetchBalancesAndAllowances();
    const interval = setInterval(fetchBalancesAndAllowances, 4000);
    return () => clearInterval(interval);
  }, [fetchBalancesAndAllowances, poolData]);

  // ── Input synchronisation using AMM quote ─────────────────────────────────
  const handlePropChange = (val) => {
    setPropInput(val);
    if (!isInitialPool && val && !isNaN(val) && Number(val) > 0) {
      try {
        const parsedProp = parseEther(val);
        // quote: amountB = (amountA * reserveB) / reserveA
        const quotedUsdc = (parsedProp * reserveB) / reserveA;
        setUsdcInput(formatUnits(quotedUsdc, 6));
      } catch {
        /* invalid big int parse */
      }
    } else if (!val) {
      setUsdcInput("");
    }
  };

  const handleUsdcChange = (val) => {
    setUsdcInput(val);
    if (!isInitialPool && val && !isNaN(val) && Number(val) > 0) {
      try {
        const parsedUsdc = parseUnits(val, 6);
        // quote: amountA = (amountB * reserveA) / reserveB
        const quotedProp = (parsedUsdc * reserveA) / reserveB;
        setPropInput(formatEther(quotedProp));
      } catch {
        /* invalid big int parse */
      }
    } else if (!val) {
      setPropInput("");
    }
  };

  // Quick Max helpers
  const handleMaxProp = () => {
    const formatted = formatEther(propBalance);
    handlePropChange(formatted);
  };

  const handleMaxUsdc = () => {
    const formatted = formatUnits(usdcBalance, 6);
    handleUsdcChange(formatted);
  };

  // ── Parse inputs ──────────────────────────────────────────────────────────
  let parsedProp = 0n;
  let parsedUsdc = 0n;
  try {
    if (propInput && Number(propInput) > 0) parsedProp = parseEther(propInput);
    if (usdcInput && Number(usdcInput) > 0) parsedUsdc = parseUnits(usdcInput, 6);
  } catch {
    /* parse error */
  }

  const hasEnoughPropBal = propBalance >= parsedProp;
  const hasEnoughUsdcBal = usdcBalance >= parsedUsdc;

  const needsPropApproval = parsedProp > 0n && propAllowance < parsedProp;
  const needsUsdcApproval = parsedUsdc > 0n && usdcAllowance < parsedUsdc;

  // Expected LP calculation
  let estimatedLp = 0n;
  if (parsedProp > 0n && parsedUsdc > 0n) {
    if (isInitialPool) {
      // Geometric mean sqrt(A * B) - 1000
      // In JS, convert to BigInt sqrt approximation
      const product = parsedProp * parsedUsdc;
      const initialRoot = sqrtBigInt(product);
      if (initialRoot > 1000n) estimatedLp = initialRoot - 1000n;
    } else {
      const lpFromA = (parsedProp * totalSupply) / reserveA;
      const lpFromB = (parsedUsdc * totalSupply) / reserveB;
      estimatedLp = lpFromA < lpFromB ? lpFromA : lpFromB;
    }
  }

  // Helper sqrt for BigInt
  function sqrtBigInt(value) {
    if (value < 0n) return 0n;
    if (value === 0n) return 0n;
    let z = value;
    let x = value / 2n + 1n;
    while (x < z) {
      z = x;
      x = (value / x + x) / 2n;
    }
    return z;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  // 1. Approve PropertyToken
  const handleApproveProp = async () => {
    if (!signer || !propertyTokenAddress || !poolAddress) return;
    try {
      setActionLoading(true);
      setActiveStep("approvingProp");
      const propContract = new Contract(propertyTokenAddress, PROPERTY_TOKEN_ABI.abi, signer);
      // Approve max or exact needed amount (use 10x or max to reduce friction)
      const tx = await propContract.approve(poolAddress, parsedProp * 100n);
      await tx.wait();
      await fetchBalancesAndAllowances();
      onSuccess("PropertyToken spending approved for Liquidity Pool.");
    } catch (err) {
      console.error(err);
      onError(err.reason || err.message || "Failed to approve PropertyToken.");
    } finally {
      setActionLoading(false);
      setActiveStep("idle");
    }
  };

  // 2. Approve MockUSDC
  const handleApproveUsdc = async () => {
    if (!signer || !mockUSDCAddress || !poolAddress) return;
    try {
      setActionLoading(true);
      setActiveStep("approvingUsdc");
      const usdcContract = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);
      const tx = await usdcContract.approve(poolAddress, parsedUsdc * 100n);
      await tx.wait();
      await fetchBalancesAndAllowances();
      onSuccess("MockUSDC spending approved for Liquidity Pool.");
    } catch (err) {
      console.error(err);
      onError(err.reason || err.message || "Failed to approve MockUSDC.");
    } finally {
      setActionLoading(false);
      setActiveStep("idle");
    }
  };

  // 3. Add Liquidity
  const handleAddLiquidity = async (e) => {
    e.preventDefault();
    if (!signer || !poolAddress) return;
    if (parsedProp === 0n || parsedUsdc === 0n) {
      onError("Please specify both PropertyToken and MockUSDC amounts.");
      return;
    }
    if (!hasEnoughPropBal) {
      onError("Insufficient PropertyToken balance.");
      return;
    }
    if (!hasEnoughUsdcBal) {
      onError("Insufficient MockUSDC balance.");
      return;
    }

    try {
      setActionLoading(true);
      setActiveStep("adding");
      const poolContract = new Contract(poolAddress, LIQUIDITY_POOL_ABI.abi, signer);

      const tx = await poolContract.addLiquidity(parsedProp, parsedUsdc);
      const receipt = await tx.wait();

      onSuccess(`Successfully added liquidity! Transaction: ${receipt.hash.slice(0, 10)}...`);
      setPropInput("");
      setUsdcInput("");
      await fetchBalancesAndAllowances();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      onError(err.reason || err.message || "Add liquidity transaction failed.");
    } finally {
      setActionLoading(false);
      setActiveStep("idle");
    }
  };

  return (
    <div className="liquidity-action-card">
      <div className="action-card-header">
        <h4>Provide Liquidity (Deposit)</h4>
        <span className="card-badge">Receive LP Tokens</span>
      </div>
      <p className="card-desc">
        Supply both PropertyToken and MockUSDC to receive LP-PROP tokens. Earn a 0.3% fee on
        every swap proportional to your share of the pool.
      </p>

      {isInitialPool && (
        <div className="initial-pool-banner">
          ⚠️ <strong>Initial Deposit:</strong> The pool currently has no reserves. You will define the
          starting exchange price of PropertyToken to MockUSDC with your deposit.
        </div>
      )}

      <form onSubmit={handleAddLiquidity} className="liquidity-form">
        {/* Token A Input (PROP) */}
        <div className="form-group">
          <div className="input-label-row">
            <label htmlFor="propAmount">Input Token A: PropertyToken (PROP)</label>
            <span className="balance-hint">
              Balance: {Number(formatEther(propBalance)).toFixed(2)} PROP
            </span>
          </div>
          <div className="token-input-row">
            <input
              id="propAmount"
              type="number"
              step="any"
              min="0"
              placeholder="0.0"
              value={propInput}
              onChange={(e) => handlePropChange(e.target.value)}
              disabled={actionLoading}
              required
            />
            <button
              type="button"
              className="btn btn-outline max-btn"
              onClick={handleMaxProp}
              disabled={actionLoading}
            >
              MAX
            </button>
          </div>
          {!hasEnoughPropBal && parsedProp > 0n && (
            <span className="error-hint">Exceeds available PROP balance</span>
          )}
        </div>

        <div className="plus-divider">
          <span>+</span>
        </div>

        {/* Token B Input (mUSDC) */}
        <div className="form-group">
          <div className="input-label-row">
            <label htmlFor="usdcAmount">Input Token B: MockUSDC (mUSDC)</label>
            <span className="balance-hint">
              Balance: {Number(formatUnits(usdcBalance, 6)).toFixed(2)} mUSDC
            </span>
          </div>
          <div className="token-input-row">
            <input
              id="usdcAmount"
              type="number"
              step="any"
              min="0"
              placeholder="0.0"
              value={usdcInput}
              onChange={(e) => handleUsdcChange(e.target.value)}
              disabled={actionLoading}
              required
            />
            <button
              type="button"
              className="btn btn-outline max-btn"
              onClick={handleMaxUsdc}
              disabled={actionLoading}
            >
              MAX
            </button>
          </div>
          {!hasEnoughUsdcBal && parsedUsdc > 0n && (
            <span className="error-hint">Exceeds available mUSDC balance</span>
          )}
        </div>

        {/* Expected LP Preview */}
        {estimatedLp > 0n && (
          <div className="expected-lp-box">
            <div className="expected-lp-row">
              <span>Expected LP Tokens Minted:</span>
              <strong className="text-accent">
                ≈ {Number(formatEther(estimatedLp)).toFixed(4)} LP-PROP
              </strong>
            </div>
            {!isInitialPool && totalSupply > 0n && (
              <div className="expected-lp-row" style={{ marginTop: "0.2rem", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                <span>Estimated Pool Share:</span>
                <span>
                  ≈ {((Number(estimatedLp * 10000n / (totalSupply + estimatedLp))) / 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Multi-step Approval and Deposit Controls */}
        <div className="deposit-action-steps">
          {needsPropApproval && (
            <button
              type="button"
              className="btn btn-warning step-btn"
              onClick={handleApproveProp}
              disabled={actionLoading || parsedProp === 0n || !hasEnoughPropBal}
            >
              {activeStep === "approvingProp" ? "Approving PROP..." : "1. Approve PROP"}
            </button>
          )}

          {needsUsdcApproval && (
            <button
              type="button"
              className="btn btn-warning step-btn"
              onClick={handleApproveUsdc}
              disabled={actionLoading || parsedUsdc === 0n || !hasEnoughUsdcBal}
            >
              {activeStep === "approvingUsdc"
                ? "Approving mUSDC..."
                : needsPropApproval
                ? "2. Approve mUSDC"
                : "1. Approve mUSDC"}
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary step-btn"
            disabled={
              actionLoading ||
              needsPropApproval ||
              needsUsdcApproval ||
              parsedProp === 0n ||
              parsedUsdc === 0n ||
              !hasEnoughPropBal ||
              !hasEnoughUsdcBal ||
              !isConnected
            }
          >
            {activeStep === "adding"
              ? "Supplying Liquidity..."
              : needsPropApproval || needsUsdcApproval
              ? "Supply (Complete Approvals First)"
              : "Supply Liquidity"}
          </button>
        </div>
      </form>
    </div>
  );
}
