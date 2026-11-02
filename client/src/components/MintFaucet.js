import React, { useState, useEffect, useCallback } from "react";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";
import MOCK_USDC_ABI from "../abis/MockUSDC.json";

/**
 * MintFaucet
 * One-click button that mints 10,000 mUSDC to the connected wallet.
 * Reads the user's current mUSDC balance and refreshes it after mint.
 */
export default function MintFaucet({ mockUSDCAddress, onSuccess, onError }) {
  const { signer, account, isConnected } = useWallet();
  const [balance, setBalance] = useState(null);
  const [minting, setMinting] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!signer || !account || !mockUSDCAddress) return;
    try {
      const contract = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);
      const raw = await contract.balanceOf(account);
      // mUSDC has 6 decimals
      setBalance((Number(raw) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 }));
    } catch {
      setBalance("—");
    }
  }, [signer, account, mockUSDCAddress]);

  // Load balance on first render / when deps change
  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const handleFaucet = async () => {
    if (!isConnected) { onError?.("Connect your wallet first."); return; }
    if (!mockUSDCAddress) { onError?.("MockUSDC address not configured."); return; }
    setMinting(true);
    try {
      const contract = new Contract(mockUSDCAddress, MOCK_USDC_ABI.abi, signer);
      const tx = await contract.faucet();
      await tx.wait();
      await fetchBalance();
      onSuccess?.("✅ 10,000 mUSDC sent to your wallet!");
    } catch (err) {
      onError?.(err.shortMessage || err.message || "Faucet failed");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="faucet-card">
      <div className="faucet-header">
        <div>
          <h3 className="faucet-title">mUSDC Faucet</h3>
          <p className="faucet-desc">
            Get test funds to invest in property tokens.
          </p>
        </div>
        <span className="faucet-icon">💧</span>
      </div>

      <div className="faucet-balance-row">
        <span className="faucet-balance-label">Your mUSDC Balance</span>
        <span className="faucet-balance-value">
          {balance !== null ? `${balance} mUSDC` : "—"}
        </span>
      </div>

      <button
        className="btn btn-primary faucet-btn"
        onClick={handleFaucet}
        disabled={minting || !isConnected}
      >
        {minting ? "Minting…" : "Get 10,000 mUSDC"}
      </button>

      {!isConnected && (
        <p className="faucet-note">Connect your wallet to use the faucet.</p>
      )}
    </div>
  );
}
