import React, { useState } from "react";
import { getContract } from "../utils/web3";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";

export default function PropertyDetails({
  account,
  landRegistryAddress,
  onError,
}) {
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
      const contract = getContract(LAND_REGISTRY_ABI.abi, landRegistryAddress);

      // Fetch property details
      const details = await contract.methods
        .getPropertyDetails(propertyId)
        .call();

      // Fetch ownership history
      const history = await contract.methods
        .getOwnershipHistory(propertyId)
        .call();

      // Check if title is clean
      const clean = await contract.methods.isTitleClean(propertyId).call();

      setPropertyData({
        id: details.id,
        location: details.location,
        owner: details.owner,
        area: details.area.toString(),
        price: details.price.toString(),
        documentHash: details.documentHash,
        disputed: details.disputed,
        timestamp: new Date(
          parseInt(details.timestamp) * 1000,
        ).toLocaleString(),
      });

      setOwnershipHistory(history);
      setTitleClean(clean);
    } catch (error) {
      console.error("Error fetching property details:", error);
      onError(`Property not found or error fetching details: ${error.message}`);
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </div>
        </div>
      </form>

      {propertyData && (
        <div className="card">
          <h3>Property Information</h3>

          <div className="property-detail">
            <label>Property ID:</label>
            <span className="value">{propertyData.id}</span>
          </div>

          <div className="property-detail">
            <label>Location:</label>
            <span className="value">{propertyData.location}</span>
          </div>

          <div className="property-detail">
            <label>Current Owner:</label>
            <span className="value" style={{ fontSize: "0.9rem" }}>
              {propertyData.owner}
            </span>
          </div>

          <div className="property-detail">
            <label>Area:</label>
            <span className="value">{propertyData.area} square meters</span>
          </div>

          <div className="property-detail">
            <label>Price:</label>
            <span className="value">
              {(parseFloat(propertyData.price) / 1e18).toFixed(2)} ETH (
              {propertyData.price} Wei)
            </span>
          </div>

          <div className="property-detail">
            <label>Document Hash (IPFS):</label>
            <span
              className="value"
              style={{ fontSize: "0.9rem", wordBreak: "break-all" }}
            >
              <a
                href={`https://ipfs.io/ipfs/${propertyData.documentHash}`}
                target="_blank"
                rel="noopener noreferrer"
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
            <span
              className={`property-status ${
                propertyData.disputed ? "status-disputed" : "status-clean"
              }`}
            >
              {propertyData.disputed ? "⚠️ DISPUTED" : "✅ CLEAR"}
            </span>
          </div>

          <div className="property-detail">
            <label>Title Verification:</label>
            <span
              className={`property-status ${
                titleClean ? "status-clean" : "status-disputed"
              }`}
            >
              {titleClean ? "✅ Title is CLEAN" : "❌ Title has issues"}
            </span>
          </div>
        </div>
      )}

      {ownershipHistory && ownershipHistory.length > 0 && (
        <div className="card">
          <h3>Ownership History</h3>
          <p style={{ marginBottom: "1rem", color: "#6b7280" }}>
            Complete chain of ownership from registration to present:
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {ownershipHistory.map((owner, index) => (
              <div
                key={index}
                style={{
                  padding: "1rem",
                  backgroundColor: "#f9fafb",
                  borderRadius: "0.5rem",
                  borderLeft: "4px solid #6366f1",
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
                    backgroundColor: "#6366f1",
                    color: "white",
                    fontWeight: "bold",
                  }}
                >
                  {index + 1}
                </span>
                <span style={{ fontSize: "0.9rem", wordBreak: "break-all" }}>
                  {owner}
                  {index === ownershipHistory.length - 1 && (
                    <span style={{ color: "#10b981", marginLeft: "0.5rem" }}>
                      (Current Owner)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!propertyData && !loading && (
        <div className="card" style={{ backgroundColor: "#f0f9ff" }}>
          <h3>📝 How to Verify a Property</h3>
          <ol style={{ marginLeft: "1.5rem" }}>
            <li>
              <strong>Enter Property ID:</strong> You can get this from the
              property registration receipt or contract events
            </li>
            <li>
              <strong>Click Search:</strong> The system will fetch details from
              the blockchain
            </li>
            <li>
              <strong>Review Details:</strong> Verify location, owner,
              documents, and dispute status
            </li>
            <li>
              <strong>Check Title:</strong> Look for the "Title Verification"
              status badge
            </li>
            <li>
              <strong>Review History:</strong> See the complete chain of
              ownership transfers
            </li>
            <li>
              <strong>Verify Documents:</strong> Click on the IPFS hash to view
              uploaded documents
            </li>
          </ol>
        </div>
      )}

      {!propertyData && propertyId && !loading && (
        <div className="empty-state" style={{ color: "#ef4444" }}>
          <h3>❌ Property Not Found</h3>
          <p>No property found with ID: {propertyId}</p>
          <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
            Make sure the property ID is correct and the property has been
            registered.
          </p>
        </div>
      )}
    </div>
  );
}
