import React, { useState } from "react";
import { getContract } from "../utils/web3";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";

export default function TransferOwnership({
  account,
  landRegistryAddress,
  onError,
  onSuccess,
}) {
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

  /**
   * Parse Solidity contract error messages for transfer operations
   */
  const parseTransferError = (error) => {
    const errorString = error.toString();
    
    // Check for property doesn't exist
    if (errorString.includes("Property does not exist")) {
      return {
        title: "❌ Property Not Found",
        message: "This property ID does not exist in the registry.",
        suggestion: "Please check the property ID and try again.",
      };
    }
    
    // Check for not owner error  
    if (errorString.includes("not the owner")) {
      return {
        title: "❌ Not Property Owner",
        message: "You are not the owner of this property. Only the owner can transfer ownership.",
        suggestion: "Verify you're using the correct wallet and property ID.",
      };
    }
    
    // Check for disputed property
    if (errorString.includes("disputed")) {
      return {
        title: "❌ Property Under Dispute",
        message: "This property is currently disputed and cannot be transferred until the dispute is resolved.",
        suggestion: "Wait for the dispute to be resolved before attempting transfer.",
      };
    }
    
    // Check for zero address error
    if (errorString.includes("zero") || errorString.includes("address cannot be zero")) {
      return {
        title: "❌ Invalid Address",
        message: "The new owner address cannot be zero address (0x0000...).",
        suggestion: "Please enter a valid Ethereum address.",
      };
    }
    
    // Check for same owner error
    if (errorString.includes("different from current owner")) {
      return {
        title: "❌ Same Owner",
        message: "The new owner address must be different from the current owner.",
        suggestion: "Please enter a different Ethereum address.",
      };
    }
    
    // Check for insufficient balance/gas
    if (errorString.includes("insufficient") || 
        errorString.includes("balance") ||
        errorString.includes("gas")) {
      return {
        title: "❌ Insufficient Balance or Gas",
        message: "Your account doesn't have enough ETH for the transaction.",
        suggestion: "Please add more ETH to your wallet and try again.",
      };
    }
    
    // Generic fallback
    return {
      title: "❌ Transfer Failed",
      message: errorString.length < 200 ? errorString : "The blockchain transaction failed.",
      suggestion: "Check your inputs and try again.",
    };
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
      const contract = getContract(LAND_REGISTRY_ABI.abi, landRegistryAddress);
      const details = await contract.methods
        .getPropertyDetails(formData.propertyId)
        .call();

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
      console.error("Error fetching property:", error);
      const { title, message, suggestion } = parseTransferError(error);
      const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
      onError(formattedError);
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
      const contract = getContract(LAND_REGISTRY_ABI.abi, landRegistryAddress);

      const tx = await contract.methods
        .transferOwnership(formData.propertyId, formData.newOwner)
        .send({ from: account });

      onSuccess(
        `Ownership transferred successfully! Transaction hash: ${tx.transactionHash}`,
      );

      // Reset form
      setFormData({
        propertyId: "",
        newOwner: "",
      });
      setPropertyDetails(null);
    } catch (error) {
      console.error("Error transferring ownership:", error);
      const { title, message, suggestion } = parseTransferError(error);
      const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
      onError(formattedError);
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
