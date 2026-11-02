import React from "react";
import { Link } from "react-router-dom";
import { useEthUsdPrice } from "../hooks/useEthUsdPrice";

export default function PriceTicker() {
  const { isConfigured, price, loading, error } = useEthUsdPrice();

  // Keep the top bar uncluttered until this network has a deployed consumer.
  if (!isConfigured) return null;

  const label = price
    ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : loading
      ? "Loading…"
      : "Unavailable";

  return (
    <Link
      to="/oracle"
      className={`price-ticker${error ? " price-ticker-error" : ""}`}
      title={error || "Open the Chainlink Oracle page"}
      aria-label={`Chainlink ETH USD price ${label}. Open oracle page.`}
    >
      <span className="price-ticker-symbol">ETH/USD</span>
      <strong>{label}</strong>
    </Link>
  );
}
