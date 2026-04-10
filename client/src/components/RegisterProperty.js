import React, { useState } from "react";
import { getContract, getBalance, getWeb3 } from "../utils/web3";
import { uploadFileGetCID, validateFile } from "../utils/pinata";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";

export default function RegisterProperty({
  account,
  landRegistryAddress,
  onError,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    location: "",
    area: "",
    price: "",
    documentFile: null,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const { valid, error } = validateFile(file, 10); // 10 MB limit
    if (!valid) {
      onError(`File validation failed: ${error}`);
      return;
    }

    // Update state with file
    setFormData((prev) => ({
      ...prev,
      documentFile: file,
    }));
  };

  /**
   * Parse Solidity contract error messages
   * Extracts human-readable error from blockchain revert reasons
   */
  const parseContractError = (error) => {
    const errorString = error.toString();
    
    // Check for transaction reverted without reason (common when contract require() fails)
    if (errorString.includes("TransactionRevertedWithoutReason") ||
        (errorString.includes("reverted by the EVM") && errorString.includes("status\":\"0"))) {
      return {
        title: "❌ Transaction Reverted",
        message: "The smart contract rejected the transaction, but no specific error message was provided.",
        suggestion: "Check that:\n• The document hasn't been registered before\n• All input values are correct\n• You have sufficient gas fees\n• The contract is properly deployed",
      };
    }
    
    // Check for duplicate document error
    if (errorString.includes("already registered") || 
        errorString.includes("possible duplicate")) {
      return {
        title: "❌ Document Already Registered",
        message: "This property document has already been registered in the system. Each property can only be registered once with its document.",
        suggestion: "To register a different property, please upload a different document file.",
      };
    }
    
    // Check for location validation error
    if (errorString.includes("Location cannot be empty")) {
      return {
        title: "❌ Location Error",
        message: "Property location is required and cannot be empty.",
        suggestion: "Please fill in the property location (e.g., '123 Main Street, New Delhi').",
      };
    }
    
    // Check for area validation error
    if (errorString.includes("area") && errorString.includes("greater than 0")) {
      return {
        title: "❌ Invalid Area",
        message: "Property area must be greater than 0 square meters.",
        suggestion: "Please enter a valid property area.",
      };
    }
    
    // Check for price validation error
    if (errorString.includes("price") && errorString.includes("greater than 0")) {
      return {
        title: "❌ Invalid Price",
        message: "Property price must be greater than 0 Wei.",
        suggestion: "Please enter a valid price (e.g., 1000000000000000000 for 1 ETH).",
      };
    }
    
    // Check for document hash empty error
    if (errorString.includes("Document hash cannot be empty")) {
      return {
        title: "❌ Missing Document",
        message: "The document file could not be uploaded properly to IPFS.",
        suggestion: "Please try uploading a different document file.",
      };
    }
    
    // Check for account/sender issues (not enough balance to pay gas)
    if (errorString.includes("sender account") || 
        errorString.includes("insufficient account balance")) {
      return {
        title: "❌ Insufficient Balance for Gas",
        message: "Your account doesn't have enough ETH to pay gas fees for this transaction.",
        suggestion: "Add more ETH to your wallet and try again.",
      };
    }
    
    // Check for out of gas errors
    if (errorString.includes("out of gas") || 
        errorString.includes("Out of gas")) {
      return {
        title: "❌ Transaction Ran Out of Gas",
        message: "The transaction exceeded its gas limit. This might indicate an issue with the contract call or your inputs.",
        suggestion: "Verify all inputs are correct and try again. If the problem persists, the smart contract might have an issue.",
      };
    }
    
    // Check for revert with more generic gas/transaction issues
    if (errorString.includes("insufficient") || errorString.includes("intrinsic gas")) {
      return {
        title: "❌ Gas Estimation Error",
        message: "There was a problem estimating gas for this transaction. This could be a network issue or problem with the contract call.",
        suggestion: "Try again. If it persists, ensure the contract is properly deployed and the RPC endpoint is accessible.",
      };
    }
    
    if (errorString.includes("Network error") || errorString.includes("connection")) {
      return {
        title: "❌ Network Connection Error",
        message: "Could not connect to the blockchain network.",
        suggestion: "Check that Ganache is running and accessible, then try again.",
      };
    }
    
    // Generic fallback for unknown errors
    return {
      title: "❌ Transaction Failed",
      message: errorString.length < 300 ? errorString : "The blockchain transaction failed. Please check the browser console for full error details.",
      suggestion: "Check your inputs and try again. If the problem persists, contact your admin.",
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!landRegistryAddress) {
      onError(
        "Land Registry contract address not set. Please deploy contracts first.",
      );
      return;
    }

    // Validation
    if (!formData.location.trim()) {
      onError("Please enter property location");
      return;
    }
    if (!formData.area || parseFloat(formData.area) <= 0) {
      onError("Area must be greater than 0");
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      onError("Price must be greater than 0");
      return;
    }
    if (!formData.documentFile) {
      onError("Please select a property document file to upload");
      return;
    }

    setLoading(true);

    try {
      // Check account balance for gas fees (minimum 0.1 ETH recommended for gas)
      onSuccess("🔍 Checking your account balance...");
      const balanceEth = await getBalance(account);
      console.log("Account balance:", balanceEth, "ETH");
      const minimumGasEth = 0.1; // Recommended minimum for gas fees
      
      if (parseFloat(balanceEth) < minimumGasEth) {
        onError(
          `❌ Insufficient Balance for Gas Fees\n\n` +
          `Your balance: ${balanceEth} ETH\n` +
          `Recommended minimum: ${minimumGasEth} ETH for gas fees\n\n` +
          `💡 Please request more test ETH from the Ganache faucet or add funds to your wallet.`
        );
        setLoading(false);
        return;
      }
      
      onSuccess(`✅ Balance check passed: ${balanceEth} ETH`);

      // Step 1: Upload document to Pinata
      onSuccess("Uploading document to IPFS (Pinata)...");
      const uploadResult = await uploadFileGetCID(formData.documentFile);
      
      // Check if document is a duplicate
      if (uploadResult.isDuplicate) {
        onError(
          `❌ Document Already Registered\n\n` +
          `This document has already been registered to IPFS by you or someone else.\n` +
          `IPFS Hash: ${uploadResult.cid}\n\n` +
          `💡 Each property requires a UNIQUE document. Please:\n` +
          `• Modify the document slightly (add date, version number, etc.)\n` +
          `• Or upload a completely different property document\n` +
          `• Then try registering again`
        );
        setLoading(false);
        return;
      }

      const { cid } = uploadResult;

      onSuccess(
        `Document uploaded! IPFS Hash: ${cid}. Registering property on blockchain...`,
      );

      const contract = getContract(LAND_REGISTRY_ABI.abi, landRegistryAddress);

      // Convert area to uint256
      const areaInSqMeters = parseInt(formData.area);

      // Convert price to proper BigInt format (user enters as Wei: 1000000000000000000 = 1 ETH)
      // Important: Must be converted from string to ensure proper gas estimation
      const priceInWei = formData.price.toString().trim();
      if (!/^\d+$/.test(priceInWei)) {
        onError("❌ Invalid Price Format\n\nPrice must be a valid number in Wei (e.g., 1000000000000000000)\n\n💡 No decimals or special characters allowed.");
        setLoading(false);
        return;
      }

      // Step 2: Call the smart contract with the IPFS hash
      onSuccess("📤 Sending transaction to blockchain...");
      console.log("Transaction details:", {
        location: formData.location,
        area: areaInSqMeters,
        price: priceInWei,
        documentHash: cid,
        from: account,
      });

      const tx = await contract.methods
        .registerProperty(
          formData.location,
          areaInSqMeters,
          priceInWei,
          cid, // Use the CID from Pinata
        )
        .send({ from: account, value: 0 });

      // Extract property ID from event logs
      let propertyId = null;
      if (tx.events && tx.events.PropertyRegistered) {
        const event = tx.events.PropertyRegistered;
        propertyId = event.returnValues.propertyId;
      }

      const successMessage = propertyId
        ? `🎉 Property Registered Successfully!\n\n` +
          `Property ID: ${propertyId}\n` +
          `Transaction Hash: ${tx.transactionHash}\n\n` +
          `📝 Save your Property ID - You'll need it to:\n` +
          `• Transfer ownership\n` +
          `• Raise disputes\n` +
          `• View property details`
        : `Property registered successfully! Transaction hash: ${tx.transactionHash}`;

      onSuccess(successMessage);

      // Reset form
      setFormData({
        location: "",
        area: "",
        price: "",
        documentFile: null,
      });

      // Clear file input
      const fileInput = document.getElementById("documentFile");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error registering property:", error);
      
      // Don't try to stringify BigInt - just log the error message
      console.error("Error message:", error.message);
      console.error("Error type:", error.name);
      
      const errorString = error.toString();
      console.log("Error string:", errorString);
      
      // Parse and display user-friendly error message
      const { title, message, suggestion } = parseContractError(error);
      
      // Add balance info to help debug
      try {
        const debugBalance = await getBalance(account);
        const debugMessage = `${title}\n\n${message}\n\nDebug Info: Account detected as having ${debugBalance} ETH\n\n💡 ${suggestion}`;
        onError(debugMessage);
      } catch (balanceError) {
        // If balance check fails, just show original error
        const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
        onError(formattedError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state">
        <h3>⚠️ Wallet Not Connected</h3>
        <p>Please connect your wallet to register a property.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>📝 Register New Property</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="location">Property Location *</label>
          <input
            id="location"
            type="text"
            name="location"
            placeholder="e.g., 123 Main Street, New Delhi, India"
            value={formData.location}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="area">Area (in square meters) *</label>
          <input
            id="area"
            type="number"
            name="area"
            placeholder="e.g., 5000"
            value={formData.area}
            onChange={handleChange}
            required
            disabled={loading}
            step="1"
            min="1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">Price (in Wei) *</label>
          <input
            id="price"
            type="text"
            name="price"
            placeholder="e.g., 10000000000000000000 (10 ETH in Wei)"
            value={formData.price}
            onChange={handleChange}
            required
            disabled={loading}
          />
          <small>
            💡 Tip: Use this converter: 1 ETH = 10^18 Wei. Use
            web3.utils.toWei() to convert.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="documentFile">Property Documents *</label>
          <input
            id="documentFile"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange}
            required
            disabled={loading}
          />
          <small>
            📄 Accepted formats: PDF, images (JPG, PNG), Word docs
            {formData.documentFile &&
              ` | Selected: ${formData.documentFile.name}`}
          </small>
        </div>

        <div className="form-submit">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Registering..." : "Register Property"}
          </button>
        </div>
      </form>

      <div className="card">
        <h3>Step-by-Step Guide</h3>
        <ol>
          <li>
            <strong>Prepare Documents:</strong> Scan/photograph property
            documents (deed, survey, etc.)
          </li>
          <li>
            <strong>Enter Location:</strong> Provide the property address
          </li>
          <li>
            <strong>Enter Area:</strong> Input the area in square meters
          </li>
          <li>
            <strong>Convert Price:</strong> Convert property price to Wei (1 ETH
            = 10^18 Wei)
          </li>
          <li>
            <strong>Select Document:</strong> Choose the property document file
            (PDF, image, or Word doc)
          </li>
          <li>
            <strong>Register:</strong> Click "Register Property" - your document
            will be uploaded to IPFS (Pinata) automatically
          </li>
          <li>
            <strong>Confirmation:</strong> Property and document hash will be
            stored on blockchain permanently
          </li>
        </ol>
        <p style={{ marginTop: "1rem", color: "#059669", fontWeight: "bold" }}>
          ✅ Documents are automatically uploaded to IPFS and linked to your
          property!
        </p>
      </div>
    </div>
  );
}
