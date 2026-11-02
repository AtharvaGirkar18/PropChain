import React, { useState } from "react";
import { extractSolidityError } from "../utils/web3";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";

export default function TransferOwnership({
  account,
  landRegistryAddress,
  onError,
  onSuccess,
}) {
  const { provider, signer } = useWallet();
  const [formData, setFormData] = useState({
    propertyId: "",
    newOwner: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchingProperty, setFetchingProperty] = useState(false);
  const [propertyDetails, setPropertyDetails] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFetchProperty = async () => {
    if (!formData.propertyId) {
      onError("Please enter property ID");
      return;
    }

    if (!landRegistryAddress) {
      onError("Land Registry contract address not set.");
      return;
    }

    setFetchingProperty(true);

    try {
      const contract = new Contract(landRegistryAddress, LAND_REGISTRY_ABI.abi, provider || signer);
      const details = await contract.getPropertyDetails(formData.propertyId);

      setPropertyDetails({
        id: details.id,
        location: details.location,
        owner: details.owner,
        area: details.area.toString(),
        price: details.price.toString(),
        disputed: details.disputed,
      });

      // Check if current account is the owner
      if (details.owner.toLowerCase() !== account.toLowerCase()) {
        onError("You are not the owner of this property. Cannot transfer.");
        setPropertyDetails(null);
        return;
      }

      if (details.disputed) {
        onError("This property is currently disputed. Cannot transfer.");
        setPropertyDetails(null);
        return;
      }
    } catch (error) {
      onError(`Failed to fetch property: ${extractSolidityError(error)}`);
      setPropertyDetails(null);
    } finally {
      setFetchingProperty(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!landRegistryAddress) {
      onError("Land Registry contract address not set.");
      return;
    }

    // Validation
    if (!formData.propertyId) {
      onError("Please enter property ID");
      return;
    }
    if (!formData.newOwner.trim()) {
      onError("Please enter new owner address");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(formData.newOwner)) {
      onError("Invalid Ethereum address format");
      return;
    }
    if (formData.newOwner.toLowerCase() === account.toLowerCase()) {
      onError("New owner must be different from current owner");
      return;
    }

    setLoading(true);

    try {
      const contract = new Contract(landRegistryAddress, LAND_REGISTRY_ABI.abi, signer);

      const tx = await contract.transferOwnership(
        formData.propertyId,
        formData.newOwner,
      );
      const receipt = await tx.wait();

      onSuccess(`Ownership transferred successfully. Tx: ${receipt.hash}`);

      // Reset form
      setFormData({
        propertyId: "",
        newOwner: "",
      });
      setPropertyDetails(null);
    } catch (error) {
      onError(`Transfer failed: ${extractSolidityError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state">
        <h3>⚠️ Wallet Not Connected</h3>
        <p>Please connect your wallet to transfer property ownership.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>🔄 Transfer Property Ownership</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="propertyId">Property ID *</label>
          <div style={{ display: "flex", gap: "1rem" }}>
            <input
              id="propertyId"
              type="number"
              name="propertyId"
              placeholder="e.g., 1"
              value={formData.propertyId}
              onChange={handleChange}
              required
              disabled={loading || fetchingProperty}
              style={{ flex: 1 }}
              min="1"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleFetchProperty}
              disabled={loading || fetchingProperty || !formData.propertyId}
            >
              {fetchingProperty ? "Fetching..." : "Fetch Details"}
            </button>
          </div>
        </div>

        {propertyDetails && (
          <div className="card">
            <h3>Current Property Details</h3>
            <div className="property-detail">
              <label>Property ID:</label>
              <span className="value">{propertyDetails.id}</span>
            </div>
            <div className="property-detail">
              <label>Location:</label>
              <span className="value">{propertyDetails.location}</span>
            </div>
            <div className="property-detail">
              <label>Current Owner:</label>
              <span className="value">{propertyDetails.owner}</span>
            </div>
            <div className="property-detail">
              <label>Area:</label>
              <span className="value">{propertyDetails.area} sq.m</span>
            </div>
            <div className="property-detail">
              <label>Price:</label>
              <span className="value">
                {(parseFloat(propertyDetails.price) / 1e18).toFixed(2)} ETH (
                {propertyDetails.price} Wei)
              </span>
            </div>
            <div className="property-detail">
              <label>Status:</label>
              <span
                className={`property-status ${
                  propertyDetails.disputed ? "status-disputed" : "status-clean"
                }`}
              >
                {propertyDetails.disputed ? "⚠️ Disputed" : "✅ Clear"}
              </span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="newOwner">New Owner Address *</label>
          <input
            id="newOwner"
            type="text"
            name="newOwner"
            placeholder="e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f..."
            value={formData.newOwner}
            onChange={handleChange}
            required
            disabled={loading}
          />
          <small>
            💡 Make sure the address is valid and belongs to the buyer.
            Transfers cannot be reversed!
          </small>
        </div>

        <div className="form-submit">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !propertyDetails}
          >
            {loading ? "Transferring..." : "Transfer Ownership"}
          </button>
        </div>
      </form>

      <div className="card">
        <h3>⚠️ Important Notes</h3>
        <ul>
          <li>You can only transfer properties you own</li>
          <li>
            Property cannot be transferred if it's currently marked as disputed
          </li>
          <li>
            Be absolutely sure of the recipient's address before confirming
          </li>
          <li>Transfers are permanent and cannot be undone on blockchain</li>
          <li>
            The buyer should be ready to accept the incoming transfer and have
            their wallet prepared
          </li>
          <li>Gas fees apply for the transaction</li>
        </ul>
      </div>
    </div>
  );
}
