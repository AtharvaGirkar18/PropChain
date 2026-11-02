import React, { useState } from "react";
import { Contract, Interface, ZeroAddress, parseEther } from "ethers";
import DAO_ABI from "../abis/GovernanceDAO.json";
import FACTORY_ABI from "../abis/PropertyTokenFactory.json";
import DISPUTE_ABI from "../abis/PropertyDispute.json";
import { useWallet } from "../context/WalletContext";

export default function CreateProposal({ daoAddress, factoryAddress, disputeAddress, account, onSuccess, onError, onCreated }) {
  const { signer } = useWallet();
  const [kind, setKind] = useState("text");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState({ disputeId: "", resolution: "", propertyId: "", name: "", symbol: "", supply: "10000" });
  const [busy, setBusy] = useState(false);
  const change = (e) => setFields((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!description.trim()) return onError("Enter a proposal description.");
    let target = ZeroAddress; let data = "0x";
    try {
      if (kind === "dispute") {
        if (!disputeAddress || !fields.disputeId || !fields.resolution.trim()) throw new Error("Enter the dispute contract, ID, and resolution.");
        target = disputeAddress;
        data = new Interface(DISPUTE_ABI.abi).encodeFunctionData("resolveDispute", [fields.disputeId, fields.resolution]);
      } else if (kind === "tokenize") {
        if (!factoryAddress || !fields.propertyId || !fields.name.trim() || !fields.symbol.trim() || !fields.supply) throw new Error("Fill in all tokenization fields and configure the factory address.");
        target = factoryAddress;
        data = new Interface(FACTORY_ABI.abi).encodeFunctionData("createToken", [fields.propertyId, fields.name, fields.symbol, parseEther(fields.supply)]);
      }
      setBusy(true);
      const dao = new Contract(daoAddress, DAO_ABI.abi, signer);
      const tx = await dao.createProposal(description.trim(), target, data);
      await tx.wait();
      setDescription(""); onSuccess("Proposal created on-chain."); onCreated();
    } catch (e) { onError(e.shortMessage || e.message || "Could not create proposal."); }
    finally { setBusy(false); }
  };

  if (!account) return <p className="meta">Connect a wallet to create proposals.</p>;
  return <form className="create-proposal" onSubmit={submit}>
    <h3>Create a proposal</h3>
    <div className="form-group"><label>Proposal type</label><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="text">General text proposal</option><option value="dispute">Resolve a property dispute</option><option value="tokenize">Create a property token</option></select></div>
    <div className="form-group"><label>Description</label><textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Describe the requested decision" /></div>
    {kind === "dispute" && <><div className="form-group"><label>Dispute ID</label><input name="disputeId" type="number" min="1" value={fields.disputeId} onChange={change} required /></div><div className="form-group"><label>Resolution text</label><textarea name="resolution" rows="2" value={fields.resolution} onChange={change} required /></div><small className="meta">The DAO needs to be configured as an authorized resolver on PropertyDispute.</small></>}
    {kind === "tokenize" && <><div className="form-grid"><div className="form-group"><label>Property ID</label><input name="propertyId" type="number" min="1" value={fields.propertyId} onChange={change} required /></div><div className="form-group"><label>Total supply (PROP tokens)</label><input name="supply" type="number" min="1" value={fields.supply} onChange={change} required /></div><div className="form-group"><label>Token name</label><input name="name" value={fields.name} onChange={change} required /></div><div className="form-group"><label>Token symbol</label><input name="symbol" value={fields.symbol} onChange={change} required /></div></div><p className="meta">After approval, the factory assigns the initial token supply to the registered property owner. Configure the factory with the LandRegistry address before using this action.</p></>}
    {kind === "text" && <p className="meta">Text proposals record a community decision on-chain; execution only emits the decision and does not change an external contract.</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit proposal"}</button>
  </form>;
}
