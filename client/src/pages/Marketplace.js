import React, { useEffect, useMemo, useState } from "react";
import { formatEther } from "ethers";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";
import { getContract, extractSolidityError } from "../utils/web3";
import { Link } from "react-router-dom";
import FACTORY_ABI from "../abis/PropertyTokenFactory.json";
import { hasValidAddress } from "../config/contracts";

export default function Marketplace({ landRegistryAddress, refreshKey, propertyTokenFactoryAddress, propertyTokens = {} }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canLoad = useMemo(
    () => Boolean(landRegistryAddress && !landRegistryAddress.endsWith("0000")),
    [landRegistryAddress],
  );

  useEffect(() => {
    const loadProperties = async () => {
      if (!canLoad) {
        setProperties([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const contract = getContract(
          LAND_REGISTRY_ABI.abi,
          landRegistryAddress,
        );
        const propertyCount = Number(await contract.getPropertyCount());

        const rows = [];
        for (let i = 1; i <= propertyCount; i += 1) {
          const details = await contract.getPropertyDetails(i);
          rows.push({
            id: Number(details.id),
            owner: details.owner,
            location: details.location,
            area: Number(details.area),
            price: formatEther(details.price),
            documentHash: details.documentHash,
            disputed: details.disputed,
            timestamp: new Date(
              Number(details.timestamp) * 1000,
            ).toLocaleString(),
            tokenAddress: propertyTokens[i] || "",
          });
        }

        if (hasValidAddress(propertyTokenFactoryAddress)) {
          const factory = getContract(FACTORY_ABI.abi, propertyTokenFactoryAddress);
          await Promise.all(rows.map(async (row) => {
            try {
              const token = await factory.getToken(row.id);
              if (hasValidAddress(token)) row.tokenAddress = token;
            } catch { /* Keep the legacy map fallback if the factory call is unavailable. */ }
          }));
        }

        setProperties(rows.reverse());
      } catch (err) {
        setError(extractSolidityError(err));
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, [landRegistryAddress, canLoad, refreshKey, propertyTokenFactoryAddress, propertyTokens]);

  return (
    <section className="panel">
      <h2>Property Marketplace</h2>
      <p className="panel-note">
        Browse registered properties and open each property's own investment page.
      </p>

      {!canLoad && (
        <div className="alert alert-warning">
          Contract addresses are placeholders on this network. Deploy and update
          address config before loading marketplace data.
        </div>
      )}

      {loading && <div className="alert alert-info">Loading properties...</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="market-grid">
        {properties.map((property) => (
          <article key={property.id} className="market-card">
            <div className="market-card-header">
              <span className="chip">Property #{property.id}</span>
              <span
                className={`chip ${
                  property.disputed ? "chip-danger" : "chip-success"
                }`}
              >
                {property.disputed ? "Disputed" : "Clear"}
              </span>
            </div>
            <h3>{property.location}</h3>
            <p>Area: {property.area} sq m</p>
            <p>Price: {Number(property.price).toFixed(4)} ETH</p>
            <p>
              Owner: {property.owner.slice(0, 6)}...{property.owner.slice(-4)}
            </p>
            <p className="meta">Registered: {property.timestamp}</p>
            <a
              className="doc-link"
              href={`https://ipfs.io/ipfs/${property.documentHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View property proof
            </a>
            <p className="meta">{property.tokenAddress ? "Fractional token available" : "Property token not created yet"}</p>
            <Link className="btn btn-primary" to={`/property/${property.id}`}>Property details &amp; invest</Link>
          </article>
        ))}
      </div>

      {!loading && !properties.length && canLoad && (
        <div className="alert alert-info">
          No properties yet. Register one from the Admin workspace.
        </div>
      )}
    </section>
  );
}
