import React from "react";
import { usePropReferencePrice } from "../hooks/usePropReferencePrice";

export default function PropPriceOracle() {
  const reference = usePropReferencePrice();
  const lastUpdateLabel = reference.updatedAt
    ? new Date(reference.updatedAt * 1000).toLocaleString()
    : "Not recorded";

  return (
    <section className="panel oracle-page">
      <div className="oracle-page-header">
        <div>
          <h2>PROP Token Reference Price</h2>
          <p className="panel-note">
            A time-weighted mUSDC price calculated from the PROP/mUSDC liquidity pool.
          </p>
        </div>
        <span className="badge-chain">AMM Pool TWAP</span>
      </div>

      {!reference.isConfigured && (
        <div className="alert alert-warning">
          Deploy <code>PoolPriceOracle.sol</code> in Remix with the Sepolia PROP/mUSDC pool, PROP token, mUSDC token, and averaging window. Then set <code>poolPriceOracle</code> in the Sepolia block of <code>client/src/config/contracts.js</code>.
        </div>
      )}
      {reference.error && reference.isConfigured && (
        <div className="alert alert-warning">{reference.error}</div>
      )}

      <div className="oracle-metadata-grid">
        <div className="oracle-metadata-item">
          <span>TWAP · mUSDC per PROP</span>
          <strong>
            {reference.price
              ? Number(reference.price).toLocaleString(undefined, { maximumFractionDigits: 6 })
              : "Waiting for window"}
          </strong>
        </div>
        <div className="oracle-metadata-item">
          <span>Current pool spot · mUSDC per PROP</span>
          <strong>
            {reference.spotPrice
              ? Number(reference.spotPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })
              : "—"}
          </strong>
        </div>
        <div className="oracle-metadata-item">
          <span>Averaging window</span>
          <strong>
            {reference.windowSeconds
              ? `${Math.round(reference.windowSeconds / 60)} minutes`
              : "—"}
          </strong>
        </div>
        <div className="oracle-metadata-item">
          <span>Last checkpoint</span>
          <strong>{lastUpdateLabel}</strong>
        </div>
      </div>

      <div className="oracle-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={reference.recordObservation}
          disabled={!reference.isConfigured || reference.updating}
        >
          {reference.updating ? "Recording checkpoint…" : "Record pool-price checkpoint"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={reference.refresh}
          disabled={!reference.isConfigured || reference.loading}
        >
          {reference.loading ? "Refreshing…" : "Refresh PROP price"}
        </button>
        <span className="oracle-caption">
          Anyone can record a checkpoint. Record periodically and after pool trades.
        </span>
      </div>

      <p className="oracle-disclaimer">
        This is a pool-derived PROP token market reference price, not a Chainlink feed or a property appraisal. Its quality depends on timely checkpoints and sufficient pool liquidity.
      </p>
    </section>
  );
}
