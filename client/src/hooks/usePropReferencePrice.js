import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";
import POOL_PRICE_ORACLE_ABI from "../abis/PoolPriceOracle.json";

export function usePropReferencePrice() {
  const { provider, signer, chainId } = useWallet();
  const contracts = useMemo(
    () => (chainId ? getContractsForChain(chainId) : null),
    [chainId]
  );
  const oracleAddress = contracts?.poolPriceOracle || "";
  const isConfigured = hasValidAddress(oracleAddress);
  const [price, setPrice] = useState("");
  const [spotPrice, setSpotPrice] = useState("");
  const [windowSeconds, setWindowSeconds] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isConfigured || !provider) {
      setPrice("");
      setSpotPrice("");
      setError(isConfigured ? "Connect your wallet and select Sepolia." : "PROP reference oracle is not configured for this network.");
      return;
    }

    setLoading(true);
    try {
      const oracle = new Contract(oracleAddress, POOL_PRICE_ORACLE_ABI.abi, provider);
      const [spot, window, lastUpdate] = await Promise.all([
        oracle.getSpotPrice(),
        oracle.windowSeconds(),
        oracle.lastUpdateTime(),
      ]);
      setSpotPrice(formatUnits(spot, 18));
      setWindowSeconds(Number(window));
      setUpdatedAt(Number(lastUpdate));
      try {
        const [twap] = await oracle.getTwapPrice();
        setPrice(formatUnits(twap, 18));
        setError("");
      } catch {
        setPrice("");
        setError("TWAP is not ready yet. Record an observation, then wait for the configured averaging window.");
      }
    } catch (err) {
      console.error("PROP reference price read failed:", err);
      setPrice("");
      setSpotPrice("");
      setError("Could not read the PROP/mUSDC pool price. Check the deployed oracle and pool addresses.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, oracleAddress, provider]);

  const recordObservation = useCallback(async () => {
    if (!isConfigured || !signer) {
      setError("Connect Atharva or another Sepolia wallet to record an observation.");
      return;
    }
    setUpdating(true);
    try {
      const oracle = new Contract(oracleAddress, POOL_PRICE_ORACLE_ABI.abi, signer);
      const tx = await oracle.update();
      await tx.wait();
      await refresh();
    } catch (err) {
      console.error("PROP price observation failed:", err);
      setError(err?.shortMessage || "Could not record a pool-price observation.");
    } finally {
      setUpdating(false);
    }
  }, [isConfigured, oracleAddress, refresh, signer]);

  useEffect(() => {
    refresh();
    if (!isConfigured || !provider) return undefined;
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [isConfigured, provider, refresh]);

  return {
    isConfigured,
    price,
    spotPrice,
    windowSeconds,
    updatedAt,
    loading,
    updating,
    error,
    refresh,
    recordObservation,
  };
}
