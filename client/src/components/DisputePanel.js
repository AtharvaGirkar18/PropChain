import React, { useEffect, useMemo, useState } from "react";
import { extractSolidityError } from "../utils/web3";
import { uploadFileGetCID, validateFile } from "../utils/pinata";
import PROPERTY_DISPUTE_ABI from "../abis/PropertyDispute.json";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";

export default function DisputePanel({
  account,
  propertyDisputeAddress,
  onError,
  onSuccess,
}) {
  const { provider, signer } = useWallet();
  const [adminAddress, setAdminAddress] = useState("");
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAdminAddress("");
    if (!propertyDisputeAddress || !provider) return () => { cancelled = true; };

    const contract = new Contract(propertyDisputeAddress, PROPERTY_DISPUTE_ABI.abi, provider);
    contract.admin()
      .then((address) => { if (!cancelled) setAdminAddress(address); })
      .catch(() => { if (!cancelled) setAdminAddress(""); });

    return () => { cancelled = true; };
  }, [propertyDisputeAddress, provider]);

  const isAdmin = useMemo(
    () => Boolean(account && adminAddress && account.toLowerCase() === adminAddress.toLowerCase()),
    [account, adminAddress]
  );

  const getDisputeContract = (requiresSigner = false) => {
    if (!propertyDisputeAddress) {
      throw new Error("PropertyDispute contract address is not configured");
    }
    return new Contract(
      propertyDisputeAddress,
      PROPERTY_DISPUTE_ABI.abi,
      requiresSigner ? signer : provider || signer
    );
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const { valid, error } = validateFile(file, 10);
    if (!valid) {
      onError(`File validation failed: ${error}`);
      return;
    }

    setRaiseFormData((prev) => ({ ...prev, evidenceFile: file }));
  };

  const handleRaiseDispute = async (event) => {
    event.preventDefault();

    if (!raiseFormData.propertyId || !raiseFormData.reason.trim()) {
      onError("Property ID and reason are required");
      return;
    }
    if (!raiseFormData.evidenceFile) {
      onError("Please upload an evidence file");
      return;
    }

    setLoading(true);
    try {
      onSuccess("Uploading evidence to IPFS...");
      const upload = await uploadFileGetCID(raiseFormData.evidenceFile);

      const contract = getDisputeContract(true);
      const tx = await contract.raiseDispute(
        raiseFormData.propertyId,
        raiseFormData.reason,
        upload.cid,
      );
      const receipt = await tx.wait();

      onSuccess(`Dispute raised. Transaction hash: ${receipt.hash}`);
      setRaiseFormData({ propertyId: "", reason: "", evidenceFile: null });
    } catch (error) {
      onError(`Failed to raise dispute: ${extractSolidityError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (event) => {
    event.preventDefault();

    if (!isAdmin) {
      onError("Only admin can resolve disputes in legacy mode");
      return;
    }
    if (!resolveFormData.disputeId || !resolveFormData.resolution.trim()) {
      onError("Dispute ID and resolution are required");
      return;
    }

    setLoading(true);
    try {
      const contract = getDisputeContract(true);
      const tx = await contract.resolveDispute(
        resolveFormData.disputeId,
        resolveFormData.resolution,
      );
      const receipt = await tx.wait();
      onSuccess(`Dispute resolved. Transaction hash: ${receipt.hash}`);
      setResolveFormData({ disputeId: "", resolution: "" });
    } catch (error) {
      onError(`Failed to resolve dispute: ${extractSolidityError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDisputes = async () => {
    if (!searchPropertyId) {
      onError("Please enter property ID");
      return;
    }

    setLoading(true);
    try {
      const contract = getDisputeContract(false);
      const disputeIds = await contract.getDisputesByProperty(searchPropertyId);
      const rows = [];

      for (const id of disputeIds) {
        const dispute = await contract.getDisputeDetails(id);
        rows.push({
          id: Number(dispute.id),
          propertyId: Number(dispute.propertyId),
          raisedBy: dispute.raisedBy,
          reason: dispute.reason,
          evidenceHash: dispute.evidenceHash,
          resolved: dispute.resolved,
          timestamp: new Date(
            Number(dispute.timestamp) * 1000,
          ).toLocaleString(),
          resolvedAt:
            Number(dispute.resolvedAt) > 0
              ? new Date(Number(dispute.resolvedAt) * 1000).toLocaleString()
              : "-",
          resolution: dispute.resolution || "-",
        });
      }

      setDisputes(rows);
      onSuccess(`Loaded ${rows.length} dispute(s)`);
    } catch (error) {
      onError(`Failed to fetch disputes: ${extractSolidityError(error)}`);
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state">
        <h3>Wallet not connected</h3>
        <p>Connect your wallet to use dispute management.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="inline-tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === "raise" ? "active" : ""}`}
          onClick={() => setActiveTab("raise")}
        >
          Raise
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "resolve" ? "active" : ""}`}
          onClick={() => setActiveTab("resolve")}
        >
          Resolve
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          List
        </button>
      </div>

      {activeTab === "raise" && (
        <form onSubmit={handleRaiseDispute}>
          <div className="form-group">
            <label htmlFor="raise-property-id">Property ID</label>
            <input
              id="raise-property-id"
              type="number"
              min="1"
              value={raiseFormData.propertyId}
              onChange={(event) =>
                setRaiseFormData((prev) => ({
                  ...prev,
                  propertyId: event.target.value,
                }))
              }
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="raise-reason">Reason</label>
            <textarea
              id="raise-reason"
              rows="4"
              value={raiseFormData.reason}
              onChange={(event) =>
                setRaiseFormData((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="raise-file">Evidence file</label>
            <input
              id="raise-file"
              type="file"
              onChange={handleFileChange}
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Submitting..." : "Raise Dispute"}
          </button>
        </form>
      )}

      {activeTab === "resolve" && (
        <form onSubmit={handleResolveDispute}>
          {!isAdmin && (
            <div className="alert alert-warning">
              Current wallet is not the configured admin resolver.
            </div>
          )}
          <div className="form-group">
            <label htmlFor="resolve-dispute-id">Dispute ID</label>
            <input
              id="resolve-dispute-id"
              type="number"
              min="1"
              value={resolveFormData.disputeId}
              onChange={(event) =>
                setResolveFormData((prev) => ({
                  ...prev,
                  disputeId: event.target.value,
                }))
              }
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="resolve-text">Resolution</label>
            <textarea
              id="resolve-text"
              rows="4"
              value={resolveFormData.resolution}
              onChange={(event) =>
                setResolveFormData((prev) => ({
                  ...prev,
                  resolution: event.target.value,
                }))
              }
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !isAdmin}
          >
            {loading ? "Submitting..." : "Resolve Dispute"}
          </button>
        </form>
      )}

      {activeTab === "list" && (
        <div>
          <div className="form-group">
            <label htmlFor="search-disputes">Property ID</label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <input
                id="search-disputes"
                type="number"
                min="1"
                value={searchPropertyId}
                onChange={(event) => setSearchPropertyId(event.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFetchDisputes}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>

          {disputes.map((item) => (
            <article
              key={item.id}
              className="card"
              style={{ marginTop: "1rem" }}
            >
              <h4>Dispute #{item.id}</h4>
              <p>Property: {item.propertyId}</p>
              <p>Raised by: {item.raisedBy}</p>
              <p>Status: {item.resolved ? "Resolved" : "Open"}</p>
              <p>Reason: {item.reason}</p>
              <p>Raised at: {item.timestamp}</p>
              <p>Resolved at: {item.resolvedAt}</p>
              <p>Resolution: {item.resolution}</p>
              <a
                href={`https://ipfs.io/ipfs/${item.evidenceHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Evidence CID
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
