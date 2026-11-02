import React, { useState } from "react";
import { getBalance, extractSolidityError } from "../utils/web3";
import { uploadFileGetCID, validateFile } from "../utils/pinata";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";
import FACTORY_ABI from "../abis/PropertyTokenFactory.json";
import { hasValidAddress } from "../config/contracts";

export default function RegisterProperty({
  account,
  landRegistryAddress,
  propertyTokenFactoryAddress,
  onError,
  onSuccess,
}) {
  const { signer } = useWallet();
  const [formData, setFormData] = useState({
    location: "",
    area: "",
    price: "",
    documentFile: null,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const { valid, error } = validateFile(file, 10);
    if (!valid) {
      onError(`File validation failed: ${error}`);
      return;
    }
    setFormData((prev) => ({ ...prev, documentFile: file }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!landRegistryAddress) {
      onError("Land Registry contract address is not configured.");
      return;
    }

    if (!formData.location.trim()) {
      onError("Please enter property location");
      return;
    }
    if (!formData.area || Number(formData.area) <= 0) {
      onError("Area must be greater than 0");
      return;
    }
    if (!/^\d+$/.test(formData.price)) {
      onError("Price must be a whole number in Wei");
      return;
    }
    if (!formData.documentFile) {
      onError("Please upload a property document");
      return;
    }

    setLoading(true);
    try {
      const balanceEth = await getBalance(account);
      if (Number(balanceEth) < 0.01) {
        onError("Insufficient balance to cover gas fees");
        return;
      }

      onSuccess("Uploading document to IPFS...");
      const uploadResult = await uploadFileGetCID(formData.documentFile);
      if (uploadResult.isDuplicate) {
        onError("This document already exists on IPFS. Use a unique file.");
        return;
      }

      const contract = new Contract(landRegistryAddress, LAND_REGISTRY_ABI.abi, signer);
      const nextPropertyId = Number(await contract.getPropertyCount()) + 1;
      const tx = await contract.registerProperty(
        formData.location,
        Number(formData.area),
        formData.price.trim(),
        uploadResult.cid,
      );
      const receipt = await tx.wait();
      let tokenNote = "";
      if (hasValidAddress(propertyTokenFactoryAddress)) {
        try {
          const factory = new Contract(propertyTokenFactoryAddress, FACTORY_ABI.abi, signer);
          const existingToken = await factory.getToken(nextPropertyId);
          if (!hasValidAddress(existingToken) && (await factory.owner()).toLowerCase() === account.toLowerCase()) {
            const tokenTx = await factory.createToken(nextPropertyId, `PropChain Property #${nextPropertyId}`, `PROP-${nextPropertyId}`, await factory.defaultSupply());
            await tokenTx.wait();
            tokenNote = ` PROP-${nextPropertyId} was also created.`;
          }
        } catch (tokenError) {
          tokenNote = ` Token creation can be retried from the property detail page: ${tokenError.shortMessage || tokenError.message}`;
        }
      }
      onSuccess(`Property registered${tokenNote} Transaction hash: ${receipt.hash}`);
      setFormData({
        location: "",
        area: "",
        price: "",
        documentFile: null,
      });
    } catch (error) {
      onError(`Registration failed: ${extractSolidityError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state">
        <h3>Wallet not connected</h3>
        <p>Connect your wallet to register properties.</p>
      </div>
    );
  }

  return (
    <div>
      <h3>Register Property</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            type="text"
            value={formData.location}
            onChange={handleChange}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="area">Area (sq m)</label>
          <input
            id="area"
            name="area"
            type="number"
            min="1"
            value={formData.area}
            onChange={handleChange}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">Price (Wei)</label>
          <input
            id="price"
            name="price"
            type="text"
            value={formData.price}
            onChange={handleChange}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="documentFile">Document</label>
          <input
            id="documentFile"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
            onChange={handleFileChange}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Submitting..." : "Register Property"}
        </button>
      </form>
    </div>
  );
}
