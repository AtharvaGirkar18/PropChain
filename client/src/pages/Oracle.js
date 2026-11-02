import React from "react";
import { useEthUsdPrice } from "../hooks/useEthUsdPrice";

export default function Oracle() {
  const {
    chainName,
    isConfigured,
    price,
    feedDecimals,
    updatedAt,
    roundId,
    loading,
    error,
    refresh,
    history,
    historyLoading,
    historyError,
    refreshHistory,
  } = useEthUsdPrice({ includeHistory: true });

  const updatedLabel = updatedAt
    ? new Date(updatedAt * 1000).toLocaleString()
    : "Not available";
  const chartWidth = 720;
  const chartHeight = 220;
  const chartPadding = 22;
  const historyPrices = history.map((point) => point.price);
  const minPrice = historyPrices.length ? Math.min(...historyPrices) : 0;
  const maxPrice = historyPrices.length ? Math.max(...historyPrices) : 0;
  const priceRange = maxPrice - minPrice || 1;
  const chartPoints = history.map((point, index) => {
    const x = history.length === 1
      ? chartWidth / 2
      : chartPadding + (index * (chartWidth - chartPadding * 2)) / (history.length - 1);
    const y = chartHeight - chartPadding - ((point.price - minPrice) / priceRange) * (chartHeight - chartPadding * 2);
    return { ...point, x, y };
  });

  return (
    <section className="panel oracle-page">
      <div className="oracle-page-header">
        <div>
          <h2>Chainlink Price Oracle</h2>
          <p className="panel-note">
            On-chain ETH/USD data from the Chainlink price feed.
          </p>
        </div>
        <span className="badge-chain">{chainName || "Connect Sepolia"}</span>
      </div>

      {!isConfigured && (
        <div className="alert alert-warning">
          Deploy <code>PriceFeedConsumer.sol</code> from Remix using the Sepolia
          ETH/USD feed address <code>0x694AA1769357215DE4FAC081bf1f309aDC325306</code>, then save the deployed consumer address as
          <code> priceFeedConsumer </code> in the Sepolia block of
          <code> client/src/config/contracts.js</code>.
        </div>
      )}

      {isConfigured && error && <div className="alert alert-warning">{error}</div>}

      <div className="oracle-price-card">
        <span className="oracle-label">ETH / USD</span>
        <strong className="oracle-price-value">
          {price ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
        </strong>
        <span className="oracle-caption">
          {price ? "Latest valid Chainlink answer" : "No feed value loaded"}
        </span>
      </div>

      <div className="oracle-history-card">
        <div className="oracle-history-header">
          <div>
            <h3>Recent Chainlink Rounds</h3>
            <p className="oracle-caption">Historical on-chain ETH/USD answers</p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={refreshHistory}
            disabled={historyLoading || !isConfigured}
          >
            {historyLoading ? "Loading rounds…" : "Reload history"}
          </button>
        </div>
        {historyError && <div className="alert alert-warning">{historyError}</div>}
        {chartPoints.length > 1 ? (
          <>
            <div className="oracle-chart-wrap">
              <div className="oracle-chart-range">
                <span>${minPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span>${maxPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <svg
                className="oracle-history-chart"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label={`Chart of ${chartPoints.length} recent Chainlink ETH/USD rounds`}
              >
                <polyline
                  points={chartPoints.map(({ x, y }) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {chartPoints.map(({ roundId: id, x, y }) => (
                  <circle key={id} cx={x} cy={y} r="4" />
                ))}
              </svg>
              <div className="oracle-chart-range oracle-chart-dates">
                <span>{new Date(chartPoints[0].updatedAt * 1000).toLocaleString()}</span>
                <span>{new Date(chartPoints[chartPoints.length - 1].updatedAt * 1000).toLocaleString()}</span>
              </div>
            </div>
            <p className="oracle-caption">Showing {chartPoints.length} recent valid rounds. Invalid or unavailable round IDs are skipped.</p>
          </>
        ) : (
          <p className="oracle-caption">
            {historyLoading ? "Loading historical rounds from the feed…" : "Not enough valid historical rounds are available to draw a chart."}
          </p>
        )}
      </div>

      <div className="oracle-metadata-grid">
        <div className="oracle-metadata-item">
          <span>Last feed update</span>
          <strong>{updatedLabel}</strong>
        </div>
        <div className="oracle-metadata-item">
          <span>Feed decimals</span>
          <strong>{feedDecimals ?? "—"}</strong>
        </div>
        <div className="oracle-metadata-item">
          <span>Round ID</span>
          <strong>{roundId || "—"}</strong>
        </div>
      </div>

      <div className="oracle-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={refresh}
          disabled={loading || !isConfigured}
        >
          {loading ? "Reading feed…" : "Refresh price"}
        </button>
        <span className="oracle-caption">Refreshes automatically every 60 seconds.</span>
      </div>

      <p className="oracle-disclaimer">
        This page demonstrates the Chainlink ETH/USD feed only. It is separate from the project's PROP/mUSDC pool reference price.
      </p>
    </section>
  );
}
