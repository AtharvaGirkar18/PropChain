import React, { useState } from "react";
import { extractSolidityError } from "../utils/web3";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";

export default function PropertyDetails({
  account,
  landRegistryAddress,
  onError,
}) {
  const { provider, signer } = useWallet();
  const [propertyId, setPropertyId] = useState("");
  const [propertyData, setPropertyData] = useState(null);
  const [ownershipHistory, setOwnershipHistory] = useState([]);
  const [titleClean, setTitleClean] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFetchDetails = async (e) => {
    e.preventDefault();

    if (!propertyId) {
      onError("Please enter property ID");
      return;
    }

    if (!landRegistryAddress) {
      onError("Land Registry contract address not set.");
      return;
    }

    setLoading(true);

    try {
      const contract = new Contract(
        landRegistryAddress,
        LAND_REGISTRY_ABI.abi,
        provider || signer
      );

      const details = await contract.getPropertyDetails(propertyId);
      const history = await contract.getOwnershipHistory(propertyId);
      const clean = await contract.isTitleClean(propertyId);

      setPropertyData({
        id: details.id,
        location: details.location,
        owner: details.owner,
        area: details.area.toString(),
        price: details.price.toString(),
        documentHash: details.documentHash,
        disputed: details.disputed,
        timestamp: new Date(parseInt(details.timestamp) * 1000).toLocaleString(),
      });

      setOwnershipHistory(history);
      setTitleClean(clean);
    } catch (error) {
      onError(`Property lookup failed: ${extractSolidityError(error)}`);
      setPropertyData(null);
      setOwnershipHistory([]);
      setTitleClean(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>📋 Property Details & Verification</h2>

      <form onSubmit={handleFetchDetails}>
        <div className="form-group">
          <label htmlFor="searchId">Property ID *</label>
          <div style={{ display: "flex", gap: "1rem" }}>
            <input
              id="searchId"
              type="number"
              placeholder="Enter property ID to search"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              disabled={loading}
              style={{ flex: 1 }}
              min="1"
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>
          </div>
        </div>
      </form>

      {/* How-to guide shown when nothing has been searched yet */}
      {!propertyData && !loading && (
        <div className="card">
          <h3>📝 How to Verify a Property</h3>
          <ol style={{ marginLeft: "1.5rem", color: "var(--text-soft)", lineHeight: "1.8" }}>
            <li><strong style={{ color: "var(--text-main)" }}>Enter Property ID:</strong> Get this from the registration receipt or contract events.</li>
            <li><strong style={{ color: "var(--text-main)" }}>Click Search:</strong> The system will fetch details from the blockchain.</li>
            <li><strong style={{ color: "var(--text-main)" }}>Review Details:</strong> Verify location, owner, documents, and dispute status.</li>
            <li><strong style={{ color: "var(--text-main)" }}>Check Title:</strong> Look for the "Title Verification" status badge.</li>
            <li><strong style={{ color: "var(--text-main)" }}>Review History:</strong> See the complete chain of ownership transfers.</li>
            <li><strong style={{ color: "var(--text-main)" }}>Verify Documents:</strong> Click the IPFS hash to view uploaded documents.</li>
          </ol>
        </div>
      )}

      {propertyData && (
        <div className="card">
          <h3>Property Information</h3>

          <div className="property-detail">
            <label>Property ID:</label>
            <span className="value">{propertyData.id?.toString()}</span>
          </div>

          <div className="property-detail">
            <label>Location:</label>
            <span className="value">{propertyData.location}</span>
          </div>

          <div className="property-detail">
            <label>Current Owner:</label>
            <span className="value" style={{ fontSize: "0.9rem" }}>{propertyData.owner}</span>
          </div>

          <div className="property-detail">
            <label>Area:</label>
            <span className="value">{propertyData.area} square meters</span>
          </div>

          <div className="property-detail">
            <label>Price:</label>
            <span className="value">
              {(parseFloat(propertyData.price) / 1e18).toFixed(6)} ETH ({propertyData.price} Wei)
            </span>
          </div>

          <div className="property-detail">
            <label>Document Hash (IPFS):</label>
            <span className="value" style={{ fontSize: "0.9rem", wordBreak: "break-all" }}>
              <a
                href={`https://ipfs.io/ipfs/${propertyData.documentHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent-secondary)" }}
              >
                {propertyData.documentHash}
              </a>
            </span>
          </div>

          <div className="property-detail">
            <label>Registered On:</label>
            <span className="value">{propertyData.timestamp}</span>
          </div>

          <div className="property-detail">
            <label>Status:</label>
            <span className={`property-status ${propertyData.disputed ? "status-disputed" : "status-clean"}`}>
              {propertyData.disputed ? "⚠️ DISPUTED" : "✅ CLEAR"}
            </span>
          </div>

          <div className="property-detail">
            <label>Title Verification:</label>
            <span className={`property-status ${titleClean ? "status-clean" : "status-disputed"}`}>
              {titleClean ? "✅ Title is CLEAN" : "❌ Title has issues"}
            </span>
          </div>
        </div>
      )}

      {ownershipHistory && ownershipHistory.length > 0 && (
        <div className="card">
          <h3>Ownership History</h3>
          <p style={{ marginBottom: "1rem", color: "var(--text-soft)" }}>
            Complete chain of ownership from registration to present:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {ownershipHistory.map((owner, index) => (
              <div
                key={index}
                style={{
                  padding: "0.9rem 1rem",
                  backgroundColor: "rgba(34, 211, 238, 0.07)",
                  borderRadius: "10px",
                  borderLeft: "4px solid var(--accent-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent-secondary)",
                    color: "#06202b",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <span style={{ fontSize: "0.9rem", wordBreak: "break-all", color: "var(--text-main)" }}>
                  {owner}
                  {index === ownershipHistory.length - 1 && (
                    <span style={{ color: "#86efac", marginLeft: "0.5rem", fontWeight: 600 }}>
                      (Current Owner)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
