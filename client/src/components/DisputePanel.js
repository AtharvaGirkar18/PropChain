import React, { useState, useMemo } from "react";
import { getContract } from "../utils/web3";
import { uploadFileGetCID, validateFile } from "../utils/pinata";
import PROPERTY_DISPUTE_ABI from "../abis/PropertyDispute.json";

// Admin address - deployer account (Account 0 on Ganache)
const ADMIN_ADDRESS = "0x5699D2C523d1e4526288841d264E4F7706701Da1";

export default function DisputePanel({
  account,
  landRegistryAddress,
  propertyDisputeAddress,
  onError,
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState("raise");
  const [raiseFormData, setRaiseFormData] = useState({
    propertyId: "",
    reason: "",
    evidenceFile: null,
  });
  const [resolveFormData, setResolveFormData] = useState({
    disputeId: "",
    resolution: "",
  });
  const [searchPropertyId, setSearchPropertyId] = useState("");
  const [disputes, setDisputes] = useState([]);
  const [disputeDetails, setDisputeDetails] = useState({});
  const [loading, setLoading] = useState(false);

  // Check if current account is admin
  const isAdmin = useMemo(() => {
    if (!account) return false;
    return account.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  }, [account]);

  const handleRaiseChange = (e) => {
    const { name, value } = e.target;
    setRaiseFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const { valid, error } = validateFile(file, 10); // 10 MB limit
    if (!valid) {
      onError(`File validation failed: ${error}`);
      return;
    }

    // Update state with file
    setRaiseFormData((prev) => ({
      ...prev,
      evidenceFile: file,
    }));
  };

  const handleResolveChange = (e) => {
    const { name, value } = e.target;
    setResolveFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Parse Solidity contract error messages for dispute operations
   */
  const parseDisputeError = (error) => {
    const errorString = error.toString();
    
    // Check for property doesn't exist
    if (errorString.includes("Property does not exist")) {
      return {
        title: "❌ Property Not Found",
        message: "This property ID does not exist in the registry.",
        suggestion: "Please check the property ID and try again.",
      };
    }
    
    // Check for dispute doesn't exist
    if (errorString.includes("Dispute does not exist") || 
        errorString.includes("Invalid dispute ID")) {
      return {
        title: "❌ Dispute Not Found",
        message: "This dispute ID does not exist or has been resolved.",
        suggestion: "Please check the dispute ID and try again.",
      };
    }
    
    // Check for already resolved
    if (errorString.includes("already been resolved") ||
        errorString.includes("already resolved") ||
        errorString.includes("Dispute already resolved")) {
      return {
        title: "❌ Dispute Already Resolved",
        message: "This dispute has already been resolved and cannot be resolved again.",
        suggestion: "Please select a different unresolved dispute.",
      };
    }
    
    // Check for empty reason
    if (errorString.includes("Reason cannot be empty")) {
      return {
        title: "❌ Missing Dispute Reason",
        message: "A reason must be provided when raising a dispute.",
        suggestion: "Please describe why you are raising this dispute.",
      };
    }
    
    // Check for empty resolution
    if (errorString.includes("Resolution cannot be empty")) {
      return {
        title: "❌ Missing Resolution",
        message: "A resolution must be provided when resolving a dispute.",
        suggestion: "Please describe the dispute resolution.",
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
      title: "❌ Operation Failed",
      message: errorString.length < 200 ? errorString : "The blockchain operation failed.",
      suggestion: "Check your inputs and try again.",
    };
  };

  const handleRaiseDispute = async (e) => {
    e.preventDefault();

    if (!propertyDisputeAddress) {
      onError("PropertyDispute contract address not set.");
      return;
    }

    if (!raiseFormData.propertyId) {
      onError("Please enter property ID");
      return;
    }

    if (!raiseFormData.reason.trim()) {
      onError("Please provide a reason for the dispute");
      return;
    }

    if (!raiseFormData.evidenceFile) {
      onError("Please select evidence document file to upload");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Upload evidence to Pinata
      onSuccess("Uploading evidence documents to IPFS (Pinata)...");
      const { cid } = await uploadFileGetCID(raiseFormData.evidenceFile);

      onSuccess(
        `Evidence uploaded! IPFS Hash: ${cid}. Raising dispute on blockchain...`,
      );

      const contract = getContract(
        PROPERTY_DISPUTE_ABI.abi,
        propertyDisputeAddress,
      );

      // Step 2: Call contract with the IPFS hash
      const tx = await contract.methods
        .raiseDispute(
          raiseFormData.propertyId,
          raiseFormData.reason,
          cid, // Use the CID from Pinata
        )
        .send({ from: account });

      onSuccess(
        `Dispute raised successfully! Evidence IPFS Hash: ${cid}. Transaction hash: ${tx.transactionHash}`,
      );

      setRaiseFormData({
        propertyId: "",
        reason: "",
        evidenceFile: null,
      });

      // Clear file input
      const fileInput = document.getElementById("evidenceFileInput");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error raising dispute:", error);
      const { title, message, suggestion } = parseDisputeError(error);
      const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
      onError(formattedError);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      onError("Only admin can resolve disputes");
      return;
    }

    if (!propertyDisputeAddress) {
      onError("PropertyDispute contract address not set.");
      return;
    }

    if (!resolveFormData.disputeId) {
      onError("Please enter dispute ID");
      return;
    }

    if (!resolveFormData.resolution.trim()) {
      onError("Please provide a resolution");
      return;
    }

    setLoading(true);

    try {
      const contract = getContract(
        PROPERTY_DISPUTE_ABI.abi,
        propertyDisputeAddress,
      );

      // Verify dispute exists before attempting to resolve
      try {
        const disputeDetails = await contract.methods
          .getDisputeDetails(resolveFormData.disputeId)
          .call();

        // Check if dispute has valid data (id should be > 0)
        if (!disputeDetails.id || disputeDetails.id === 0) {
          onError(
            `Dispute ID ${resolveFormData.disputeId} does not exist. Please enter a valid dispute ID.`,
          );
          setLoading(false);
          return;
        }

        // Check if dispute is already resolved
        if (disputeDetails.isResolved || disputeDetails.resolved) {
          onError(
            `Dispute ID ${resolveFormData.disputeId} has already been resolved. Cannot resolve the same dispute twice.`,
          );
          setLoading(false);
          return;
        }
      } catch (disputeCheckError) {
        onError(
          `Dispute ID ${resolveFormData.disputeId} does not exist. Please enter a valid dispute ID.`,
        );
        setLoading(false);
        return;
      }

      const tx = await contract.methods
        .resolveDispute(resolveFormData.disputeId, resolveFormData.resolution)
        .send({ from: account });

      onSuccess(
        `Dispute resolved successfully! Transaction hash: ${tx.transactionHash}`,
      );

      setResolveFormData({
        disputeId: "",
        resolution: "",
      });

      // Refresh disputes list
      if (searchPropertyId) {
        handleSearchDisputes(searchPropertyId);
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      const { title, message, suggestion } = parseDisputeError(error);
      const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
      onError(formattedError);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDisputes = async (propertyId) => {
    if (!propertyId) {
      onError("Please enter property ID");
      return;
    }

    if (!propertyDisputeAddress) {
      onError("PropertyDispute contract address not set.");
      return;
    }

    setLoading(true);

    try {
      const contract = getContract(
        PROPERTY_DISPUTE_ABI.abi,
        propertyDisputeAddress,
      );

      const disputeIds = await contract.methods
        .getDisputesByProperty(propertyId)
        .call();

      setDisputes(disputeIds);
      setDisputeDetails({});

      // Fetch details for each dispute
      for (const disputeId of disputeIds) {
        const details = await contract.methods
          .getDisputeDetails(disputeId)
          .call();

        const disputeIdStr = disputeId.toString(); // Convert to string

        setDisputeDetails((prev) => ({
          ...prev,
          [disputeIdStr]: {
            id: disputeIdStr,
            propertyId: details.propertyId,
            raisedBy: details.raisedBy,
            reason: details.reason,
            evidenceHash: details.evidenceHash,
            resolved: details.resolved,
            timestamp: new Date(
              parseInt(details.timestamp) * 1000,
            ).toLocaleString(),
            resolvedAt: details.resolvedAt
              ? new Date(parseInt(details.resolvedAt) * 1000).toLocaleString()
              : "Not resolved",
            resolution: details.resolution,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching disputes:", error);
      const { title, message, suggestion } = parseDisputeError(error);
      const formattedError = `${title}\n\n${message}\n\n💡 ${suggestion}`;
      onError(formattedError);
      setDisputes([]);
      setDisputeDetails({});
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state">
        <h3>⚠️ Wallet Not Connected</h3>
        <p>Please connect your wallet to manage property disputes.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>⚠️ Property Disputes Management</h2>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
          borderBottom: "2px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`tab-button ${activeTab === "raise" ? "active" : ""}`}
          onClick={() => setActiveTab("raise")}
        >
          🚩 Raise Dispute
        </button>
        {isAdmin && (
          <button
            className={`tab-button ${activeTab === "resolve" ? "active" : ""}`}
            onClick={() => setActiveTab("resolve")}
          >
            ✅ Resolve Dispute
          </button>
        )}
        <button
          className={`tab-button ${activeTab === "view" ? "active" : ""}`}
          onClick={() => setActiveTab("view")}
        >
          📍 View Disputes
        </button>
      </div>

      {activeTab === "raise" && (
        <div>
          <h3>Raise a Dispute on a Property</h3>
          <form onSubmit={handleRaiseDispute}>
            <div className="form-group">
              <label htmlFor="propertyId">Property ID *</label>
              <input
                id="propertyId"
                type="number"
                name="propertyId"
                placeholder="e.g., 1"
                value={raiseFormData.propertyId}
                onChange={handleRaiseChange}
                required
                disabled={loading}
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Dispute *</label>
              <textarea
                id="reason"
                name="reason"
                placeholder="Explain the reason for disputing this property (e.g., previous owner claims ownership, boundary disputes, document authenticity issues, etc.)"
                value={raiseFormData.reason}
                onChange={handleRaiseChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="evidenceFileInput">Evidence Documents *</label>
              <input
                id="evidenceFileInput"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                required
                disabled={loading}
              />
              <small
                style={{ color: "#666", marginTop: "0.5rem", display: "block" }}
              >
                📄 Accepted formats: PDF, images, documents
                {raiseFormData.evidenceFile &&
                  ` | Selected: ${raiseFormData.evidenceFile.name}`}
              </small>
            </div>

            <div className="form-submit">
              <button
                type="submit"
                className="btn btn-danger"
                disabled={loading}
              >
                {loading ? "Raising Dispute..." : "Raise Dispute"}
              </button>
            </div>
          </form>

          <div className="card">
            <h3>ℹ️ When to Raise a Dispute</h3>
            <ul>
              <li>
                <strong>Ownership Claims:</strong> Previous owner claims they
                still have ownership rights
              </li>
              <li>
                <strong>Boundary Disputes:</strong> Disagreement with neighbors
                about property boundaries
              </li>
              <li>
                <strong>Document Authenticity:</strong> Suspicion that property
                documents are forged or fraudulent
              </li>
              <li>
                <strong>Title Issues:</strong> Discovery of liens, mortgages, or
                other encumbrances
              </li>
              <li>
                <strong>Duplicate Registration:</strong> Property seems to be
                registered multiple times
              </li>
              <li>
                <strong>Legal Claims:</strong> Any court cases or legal issues
                affecting ownership
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "resolve" && (
        <div>
          <h3>Resolve a Dispute</h3>
          {!isAdmin && (
            <div className="alert alert-warning">
              ⚠️ <strong>Admin Only:</strong> Only the admin account (
              {ADMIN_ADDRESS}) can resolve disputes. Please switch to the admin
              account in MetaMask to resolve disputes.
            </div>
          )}
          <form onSubmit={handleResolveDispute} disabled={!isAdmin}>
            <div className="form-group">
              <label htmlFor="disputeId">Dispute ID *</label>
              <input
                id="disputeId"
                type="number"
                name="disputeId"
                placeholder="e.g., 1"
                value={resolveFormData.disputeId}
                onChange={handleResolveChange}
                required
                disabled={loading || !isAdmin}
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="resolution">Resolution *</label>
              <textarea
                id="resolution"
                name="resolution"
                placeholder="Describe how the dispute was resolved (e.g., verified documents, settled with previous owner, court ruling obtained, etc.)"
                value={resolveFormData.resolution}
                onChange={handleResolveChange}
                required
                disabled={loading || !isAdmin}
              />
            </div>

            <div className="form-submit">
              <button
                type="submit"
                className="btn btn-success"
                disabled={loading || !isAdmin}
              >
                {loading ? "Resolving..." : "Resolve Dispute"}
              </button>
            </div>
          </form>

          <div className="card">
            <h3>📋 Resolution Guidelines</h3>
            <ul>
              <li>
                <strong>Verify Documents:</strong> Thoroughly verify all
                original property documents
              </li>
              <li>
                <strong>Check Records:</strong> Cross-reference with government
                land records
              </li>
              <li>
                <strong>Legal Review:</strong> Consult with legal experts for
                complex cases
              </li>
              <li>
                <strong>Mediation:</strong> Try to mediate between disputing
                parties
              </li>
              <li>
                <strong>Court Ruling:</strong> If necessary, obtain court order
                for resolution
              </li>
              <li>
                <strong>Clear Documentation:</strong> Document the resolution
                process thoroughly
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "view" && (
        <div>
          <h3>View Property Disputes</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchDisputes(searchPropertyId);
            }}
          >
            <div className="form-group">
              <label htmlFor="searchId">Property ID *</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <input
                  id="searchId"
                  type="number"
                  placeholder="Enter property ID to view disputes"
                  value={searchPropertyId}
                  onChange={(e) => setSearchPropertyId(e.target.value)}
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
                  {loading ? "Loading..." : "View Disputes"}
                </button>
              </div>
            </div>
          </form>

          {disputes.length > 0 ? (
            <div style={{ marginTop: "2rem" }}>
              <h4>
                Found {disputes.length} dispute(s) for Property #
                {searchPropertyId}
              </h4>
              {disputes.map((disputeId) => {
                const disputeIdStr = disputeId.toString(); // Convert to string
                const dispute = disputeDetails[disputeIdStr];
                if (!dispute) return null;

                return (
                  <div key={disputeIdStr} className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <h4>Dispute ID: {disputeIdStr}</h4>
                        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                          Raised on: {dispute.timestamp}
                        </p>
                      </div>
                      <span
                        className={`property-status ${
                          dispute.resolved ? "status-clean" : "status-disputed"
                        }`}
                      >
                        {dispute.resolved ? "✅ RESOLVED" : "🚩 ACTIVE"}
                      </span>
                    </div>

                    <div className="property-detail">
                      <label>Raised By:</label>
                      <span
                        className="value"
                        style={{ fontSize: "0.9rem", wordBreak: "break-all" }}
                      >
                        {dispute.raisedBy}
                      </span>
                    </div>

                    <div className="property-detail">
                      <label>Reason:</label>
                      <span className="value">{dispute.reason}</span>
                    </div>

                    <div className="property-detail">
                      <label>Evidence Hash (IPFS):</label>
                      <a
                        href={`https://ipfs.io/ipfs/${dispute.evidenceHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="value"
                        style={{
                          fontSize: "0.85rem",
                          wordBreak: "break-all",
                          color: "#2563eb",
                          textDecoration: "underline",
                        }}
                      >
                        {dispute.evidenceHash}
                      </a>
                    </div>

                    {dispute.resolved && (
                      <>
                        <div className="property-detail">
                          <label>Resolved On:</label>
                          <span className="value">{dispute.resolvedAt}</span>
                        </div>

                        <div className="property-detail">
                          <label>Resolution:</label>
                          <span className="value">{dispute.resolution}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : searchPropertyId ? (
            <div className="empty-state" style={{ marginTop: "2rem" }}>
              <h3>✅ No Disputes Found</h3>
              <p>
                Property #{searchPropertyId} has no disputes. The title is
                clean.
              </p>
            </div>
          ) : (
            <div className="card" style={{ marginTop: "2rem" }}>
              <h3>📝 How to View Disputes</h3>
              <ol style={{ marginLeft: "1.5rem" }}>
                <li>Enter the property ID</li>
                <li>Click "View Disputes"</li>
                <li>
                  The system will display all disputes (active and resolved) for
                  that property
                </li>
                <li>Review the reason and resolution for each dispute</li>
                <li>
                  A clean property should have no active disputes (all marked as
                  "RESOLVED")
                </li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
