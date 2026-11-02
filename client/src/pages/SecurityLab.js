import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";
import { extractSolidityError } from "../utils/web3";
import VULNERABLE_ABI from "../abis/VulnerablePool.json";
import SECURE_ABI from "../abis/SecurePool.json";
import ATTACKER_ABI from "../abis/FlashLoanAttacker.json";
import USDC_ABI from "../abis/MockUSDC.json";
import AMM_ABI from "../abis/LiquidityPool.json";

const ERC20_READ_ABI = ["function balanceOf(address) view returns (uint256)"];

export default function SecurityLab() {
  const { provider, signer, account, chainId } = useWallet();
  const contracts = useMemo(() => getContractsForChain(chainId), [chainId]);
  const [flashAmount, setFlashAmount] = useState("1000");
  const [borrowAmount, setBorrowAmount] = useState("1200");
  const [slippage, setSlippage] = useState("500");
  const [fundAmount, setFundAmount] = useState("10000");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({ vulnerablePrice: null, securePrice: null, vulnerableCash: null, secureCash: null, ammUsdcReserve: null, vulnerableDebt: null, vulnerableCollateral: null, attackerProfit: null, attackerOwner: "", vulnerableOwner: "", secureOwner: "" });

  const addressesReady = [contracts?.mockUSDC, contracts?.propertyToken, contracts?.liquidityPool, contracts?.vulnerablePool, contracts?.securePool, contracts?.flashLoanAttacker].every(hasValidAddress);
  const supportedChain = [11155111, 80002, 31337, 1337, 5777].includes(Number(chainId));
  const attackerIsOwner = Boolean(account && metrics.attackerOwner && metrics.attackerOwner.toLowerCase() === account.toLowerCase());
  const vulnerablePoolOwner = Boolean(account && metrics.vulnerableOwner && metrics.vulnerableOwner.toLowerCase() === account.toLowerCase());
  const securePoolOwner = Boolean(account && metrics.secureOwner && metrics.secureOwner.toLowerCase() === account.toLowerCase());

  const refresh = useCallback(async () => {
    if (!addressesReady || !provider) return;
    try {
      const vuln = new Contract(contracts.vulnerablePool, VULNERABLE_ABI.abi, provider);
      const secure = new Contract(contracts.securePool, SECURE_ABI.abi, provider);
      const attacker = new Contract(contracts.flashLoanAttacker, ATTACKER_ABI.abi, provider);
      const token = new Contract(contracts.mockUSDC, ERC20_READ_ABI, provider);
      const amm = new Contract(contracts.liquidityPool, AMM_ABI.abi, provider);
      const [vPrice, sPrice, vCash, sCash, owner, tokenA, reserves, vDebt, vCollateral, attackerBalance, vulnerableOwner, secureOwner] = await Promise.all([
        vuln.getCollateralPrice().catch(() => null), secure.getCollateralPrice().catch(() => null),
        token.balanceOf(contracts.vulnerablePool), token.balanceOf(contracts.securePool), attacker.owner(), amm.tokenA(), amm.getReserves(),
        vuln.borrowed(contracts.flashLoanAttacker), vuln.collateralBalance(contracts.flashLoanAttacker), token.balanceOf(contracts.flashLoanAttacker), vuln.owner(), secure.owner(),
      ]);
      const stableReserve = tokenA.toLowerCase() === contracts.mockUSDC.toLowerCase() ? reserves[0] : reserves[1];
      setMetrics({ vulnerablePrice: vPrice === null ? null : formatUnits(vPrice, 6), securePrice: sPrice === null ? null : formatUnits(sPrice, 6), vulnerableCash: formatUnits(vCash, 6), secureCash: formatUnits(sCash, 6), ammUsdcReserve: formatUnits(stableReserve, 6), vulnerableDebt: formatUnits(vDebt, 6), vulnerableCollateral: formatUnits(vCollateral, 18), attackerProfit: formatUnits(attackerBalance, 6), attackerOwner: owner, vulnerableOwner, secureOwner });
    } catch (e) { setError(extractSolidityError(e)); }
  }, [addressesReady, provider, contracts]);

  useEffect(() => { refresh(); }, [refresh]);

  const fund = async (kind) => {
    const poolAddress = kind === "vulnerable" ? contracts.vulnerablePool : contracts.securePool;
    const abi = kind === "vulnerable" ? VULNERABLE_ABI.abi : SECURE_ABI.abi;
    setBusy(`fund-${kind}`); setError(""); setMessage("");
    try {
      const amount = parseUnits(fundAmount, 6);
      const token = new Contract(contracts.mockUSDC, USDC_ABI.abi, signer);
      await (await token.approve(poolAddress, amount)).wait();
      await (await new Contract(poolAddress, abi, signer).fund(amount)).wait();
      setMessage(`${kind === "vulnerable" ? "Vulnerable" : "Secure"} pool funded with ${fundAmount} mUSDC.`);
      await refresh();
    } catch (e) { setError(extractSolidityError(e)); }
    finally { setBusy(""); }
  };

  const runAttack = async (kind) => {
    setBusy(`attack-${kind}`); setError(""); setMessage("");
    try {
      const target = kind === "vulnerable" ? contracts.vulnerablePool : contracts.securePool;
      const tx = await new Contract(contracts.flashLoanAttacker, ATTACKER_ABI.abi, signer).executeAttack(
        target, parseUnits(flashAmount, 6), parseUnits(borrowAmount, 6), Number(slippage),
      );
      await tx.wait();
      setMessage(`${kind === "vulnerable" ? "Vulnerable" : "Secure"} pool transaction succeeded. Refresh balances to inspect the result.`);
      await refresh();
    } catch (e) {
      const reason = extractSolidityError(e);
      setError(`${kind === "secure" ? "Secure pool blocked the attack" : "Attack reverted"}: ${reason}`);
      await refresh();
    } finally { setBusy(""); }
  };

  return <section className="panel security-lab">
    <div className="security-lab-header"><div><h2>Security Lab · Flash-Loan Price Manipulation</h2><p className="panel-note">A real on-chain demonstration using the configured PROP/mUSDC AMM, a vulnerable lending pool, and a mitigated pool.</p></div><span className="chip chip-danger">Testnet / local only</span></div>
    {!supportedChain && <div className="alert alert-warning">Switch to Sepolia, Polygon Amoy, or a local development chain before using the Security Lab.</div>}
    {!addressesReady && <div className="alert alert-info">Exp9 contracts are not configured on this network yet. Compile and deploy <code>VulnerablePool.sol</code>, <code>SecurePool.sol</code>, and <code>FlashLoanAttacker.sol</code> in Remix, then add their addresses in the network block of <code>client/src/config/contracts.js</code>. This page remains inactive until all required addresses are set.</div>}
    {error && <div className="alert alert-error">{error}</div>}{message && <div className="alert alert-success">{message}</div>}

    <div className="security-theory-grid">
      <article className="card"><h3>Vulnerable design</h3><p>Borrowing power reads the AMM reserve ratio in the same transaction that a flash loan can move. The borrower can also withdraw collateral while leaving debt behind.</p><pre><code>{`price = reserveUSDC / reservePROP;
maxBorrow = collateral * price * LTV;
// repayment check ignores the pool's starting balance`}</code></pre></article>
      <article className="card"><h3>Mitigated design</h3><p>The secure pool uses a trusted reference price that spot swaps cannot change, checks the remaining debt before collateral withdrawal, and applies CEI plus <code>ReentrancyGuard</code>.</p><pre><code>{`borrowed[user] += amount;
loanToken.safeTransfer(user, amount);
// health-check collateral before withdrawal`}</code></pre></article>
    </div>

    {addressesReady && <>
      {!account && <div className="alert alert-warning">Connect the deployer wallet to fund the pools and run the attack contract.</div>}
      <div className="security-metrics-grid">
        <Metric title="AMM mUSDC reserve" value={metrics.ammUsdcReserve} suffix="mUSDC" />
        <Metric title="Vulnerable spot price" value={metrics.vulnerablePrice} suffix="mUSDC / PROP" />
        <Metric title="Secure reference price" value={metrics.securePrice} suffix="mUSDC / PROP" />
        <Metric title="Vulnerable pool cash" value={metrics.vulnerableCash} suffix="mUSDC" />
        <Metric title="Secure pool cash" value={metrics.secureCash} suffix="mUSDC" />
        <Metric title="Vulnerable pool bad debt" value={metrics.vulnerableDebt} suffix="mUSDC" />
        <Metric title="Vulnerable collateral remaining" value={metrics.vulnerableCollateral} suffix="PROP" />
        <Metric title="Attacker contract balance" value={metrics.attackerProfit} suffix="mUSDC" />
      </div>
      {metrics.attackerOwner && account && metrics.attackerOwner.toLowerCase() !== account.toLowerCase() && <div className="alert alert-warning">Connected wallet is not the owner of the configured FlashLoanAttacker contract.</div>}
      <div className="security-control-grid">
        <PoolFundingCard title="Fund vulnerable pool" balance={metrics.vulnerableCash} amount={fundAmount} setAmount={setFundAmount} disabled={!vulnerablePoolOwner || Boolean(busy) || !supportedChain} loading={busy === "fund-vulnerable"} onFund={() => fund("vulnerable")} />
        <PoolFundingCard title="Fund secure pool" balance={metrics.secureCash} amount={fundAmount} setAmount={setFundAmount} disabled={!securePoolOwner || Boolean(busy) || !supportedChain} loading={busy === "fund-secure"} onFund={() => fund("secure")} />
      </div>
      <div className="security-attack-controls">
        <h3>Attack parameters</h3>
        <p className="panel-note">Tune the flash amount to the AMM reserve (a larger trade causes a larger spot-price move). The vulnerable lender needs cash of at least flash amount + attempted borrow. The secure reference price is in mUSDC base units per whole PROP; 1 mUSDC per PROP is <code>1000000</code>.</p>
        <div className="form-grid">
          <div className="form-group"><label>Flash-loan amount (mUSDC)</label><input type="number" min="0.01" step="any" value={flashAmount} onChange={(e) => setFlashAmount(e.target.value)} /></div>
          <div className="form-group"><label>Attempted borrow (mUSDC)</label><input type="number" min="0.01" step="any" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} /></div>
          <div className="form-group"><label>Slippage limit (basis points)</label><input type="number" min="1" max="9999" value={slippage} onChange={(e) => setSlippage(e.target.value)} /><small>500 bps = 5%; applied to both AMM swaps.</small></div>
        </div>
        <div className="proposal-actions"><button className="btn btn-danger" disabled={!attackerIsOwner || Boolean(busy) || !supportedChain} onClick={() => runAttack("vulnerable")}>{busy === "attack-vulnerable" ? "Running attack…" : "Attack vulnerable pool"}</button><button className="btn btn-primary" disabled={!attackerIsOwner || Boolean(busy) || !supportedChain} onClick={() => runAttack("secure")}>{busy === "attack-secure" ? "Trying secure pool…" : "Try same attack on secure pool"}</button><button className="btn btn-outline" disabled={Boolean(busy)} onClick={refresh}>Refresh on-chain state</button></div>
      </div>
    </>}
    <div className="alert alert-info security-disclaimer">Educational testnet contracts only. The secure pool uses an owner-maintained reference price because the project has no Chainlink PROP/mUSDC feed; Exp7’s ETH/USD feed is not a valid substitute for a property-token price feed.</div>
  </section>;
}

function Metric({ title, value, suffix }) {
  return <div className="security-metric"><span>{title}</span><strong>{value ?? "—"} {value !== null ? suffix : ""}</strong></div>;
}

function PoolFundingCard({ title, balance, amount, setAmount, disabled, loading, onFund }) {
  return <article className="card"><h3>{title}</h3><p>Available pool cash: {balance ?? "—"} mUSDC</p><div className="form-group"><label>Deposit mUSDC</label><input type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={disabled} /></div><button className="btn btn-secondary" disabled={disabled} onClick={onFund}>{loading ? "Approving and funding…" : "Approve & fund"}</button></article>;
}
