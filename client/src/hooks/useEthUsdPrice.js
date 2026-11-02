import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { useWallet } from "../context/WalletContext";
import { getContractsForChain, hasValidAddress } from "../config/contracts";
import PRICE_FEED_CONSUMER_ABI from "../abis/PriceFeedConsumer.json";
import AGGREGATOR_V3_ABI from "../abis/AggregatorV3.json";

export function useEthUsdPrice({ includeHistory = false } = {}) {
  const { provider, chainId } = useWallet();
  const contracts = useMemo(
    () => (chainId ? getContractsForChain(chainId) : null),
    [chainId]
  );
  const consumerAddress = contracts?.priceFeedConsumer || "";
  const isConfigured = hasValidAddress(consumerAddress);

  const [price, setPrice] = useState("");
  const [feedDecimals, setFeedDecimals] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [roundId, setRoundId] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setPrice("");
      setError("Price feed consumer is not configured for this network.");
      return;
    }
    if (!provider) {
      setPrice("");
      setError("Connect a wallet and select Sepolia to read the feed.");
      return;
    }

    setLoading(true);
    try {
      const consumer = new Contract(
        consumerAddress,
        PRICE_FEED_CONSUMER_ABI.abi,
        provider
      );
      const [latestRoundId, answer, decimals, timestamp] =
        await consumer.getLatestPrice();
      setPrice(formatUnits(answer, Number(decimals)));
      setFeedDecimals(Number(decimals));
      setUpdatedAt(Number(timestamp));
      setRoundId(latestRoundId.toString());
      setError("");
    } catch (err) {
      console.error("ETH/USD feed read failed:", err);
      setPrice("");
      setUpdatedAt(null);
      setError(
        "Could not read a valid ETH/USD update. The feed may be stale or unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, [consumerAddress, isConfigured, provider]);

  const refreshHistory = useCallback(async () => {
    if (!includeHistory || !isConfigured || !provider) return;
    setHistoryLoading(true);
    try {
      const consumer = new Contract(
        consumerAddress,
        PRICE_FEED_CONSUMER_ABI.abi,
        provider
      );
      const [latestRoundId, latestAnswer, latestDecimals, latestTimestamp] =
        await consumer.getLatestPrice();
      const feedAddress = await consumer.priceFeed();
      const feed = new Contract(feedAddress, AGGREGATOR_V3_ABI.abi, provider);
      const decimals = Number(await feed.decimals());
      const latest = window.BigInt(latestRoundId);
      const samples = [];
      let offset = 1n;
      samples.push({
        roundId: latestRoundId.toString(),
        price: Number(formatUnits(latestAnswer, Number(latestDecimals))),
        updatedAt: Number(latestTimestamp),
      });

      // Proxy round IDs may contain gaps. Scan backward in small parallel batches,
      // skipping IDs the feed reports as unavailable.
      while (samples.length < 20 && offset <= 120n) {
        const batchIds = [];
        for (let i = 0; i < 8 && offset <= 120n; i += 1, offset += 1n) {
          if (latest > offset) batchIds.push(latest - offset);
        }
        const results = await Promise.allSettled(
          batchIds.map((id) => feed.getRoundData(id))
        );
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const [id, answer, , timestamp] = result.value;
          if (answer <= 0n || timestamp === 0n) continue;
          samples.push({
            roundId: id.toString(),
            price: Number(formatUnits(answer, decimals)),
            updatedAt: Number(timestamp),
          });
        }
      }

      samples.sort((a, b) => a.updatedAt - b.updatedAt);
      setHistory(samples.slice(-20));
      setHistoryError("");
    } catch (err) {
      console.error("ETH/USD history read failed:", err);
      setHistory([]);
      setHistoryError("Could not load recent feed rounds.");
    } finally {
      setHistoryLoading(false);
    }
  }, [consumerAddress, includeHistory, isConfigured, provider]);

  useEffect(() => {
    refresh();
    if (!isConfigured || !provider) return undefined;
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh, isConfigured, provider]);

  useEffect(() => {
    if (includeHistory && isConfigured && provider) refreshHistory();
  }, [includeHistory, isConfigured, provider, refreshHistory]);

  return {
    chainName: contracts?.name || "",
    consumerAddress,
    isConfigured,
    price,
    feedDecimals,
    updatedAt,
    roundId,
    history,
    historyLoading,
    historyError,
    loading,
    error,
    refresh,
    refreshHistory,
  };
}
