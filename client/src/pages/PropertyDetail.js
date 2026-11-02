import React, { useCallback, useEffect, useState } from "react";
import { Contract, formatEther, parseEther } from "ethers";
import { Link, useParams } from "react-router-dom";
import LAND_REGISTRY_ABI from "../abis/LandRegistry.json";
import FACTORY_ABI from "../abis/PropertyTokenFactory.json";
import InvestPanel from "../components/InvestPanel";
import { useWallet } from "../context/WalletContext";
import { hasValidAddress } from "../config/contracts";
import { extractSolidityError } from "../utils/web3";

export default function PropertyDetail({ landRegistryAddress, propertyTokenFactoryAddress, propertyTokens = {}, mockUSDCAddress }) {
  const { id } = useParams();
  const { provider, signer, account } = useWallet();
  const [property, setProperty] = useState(null);
  const [tokenAddress, setTokenAddress] = useState(propertyTokens[id] || "");
  const [canCreate, setCanCreate] = useState(false);
  const [supply, setSupply] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      if (!hasValidAddress(landRegistryAddress) || !provider) return;
      const registry = new Contract(landRegistryAddress, LAND_REGISTRY_ABI.abi, provider);
      const p = await registry.getPropertyDetails(id);
      setProperty({ id: Number(p.id), owner: p.owner, location: p.location, area: Number(p.area), price: formatEther(p.price), disputed: p.disputed, documentHash: p.documentHash });
      let currentToken = propertyTokens[id] || "";
      if (hasValidAddress(propertyTokenFactoryAddress)) {
        const factory = new Contract(propertyTokenFactoryAddress, FACTORY_ABI.abi, provider);
        const deployedToken = await factory.getToken(id);
        if (hasValidAddress(deployedToken)) currentToken = deployedToken;
        if (account) setCanCreate((await factory.owner()).toLowerCase() === account.toLowerCase());
      }
      setTokenAddress(currentToken);
    } catch (e) { setError(extractSolidityError(e)); }
  }, [landRegistryAddress, propertyTokenFactoryAddress, propertyTokens, id, provider, account]);
  useEffect(() => { load(); }, [load]);

  const createToken = async (event) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const factory = new Contract(propertyTokenFactoryAddress, FACTORY_ABI.abi, signer);
      const tx = await factory.createToken(id, `PropChain Property #${id}`, `PROP-${id}`, parseEther(supply));
      await tx.wait(); await load();
    } catch (e) { setError(extractSolidityError(e)); }
    finally { setLoading(false); }
  };

  return <section className="panel">
    <Link to="/" className="doc-link">← Back to marketplace</Link>
    <h2>Property #{id}</h2>
    {error && <div className="alert alert-error">{error}</div>}
    {!property && !error && <p className="meta">Loading property…</p>}
    {property && <>
      <div className="property-detail-grid"><div className="card"><h3>{property.location}</h3><p>Area: {property.area} sq m</p><p>Registry price: {Number(property.price).toFixed(4)} ETH</p><p>Owner: {property.owner}</p><p>Status: {property.disputed ? "Disputed" : "Clear"}</p><a href={`https://ipfs.io/ipfs/${property.documentHash}`} target="_blank" rel="noreferrer">View property proof</a></div></div>
      {hasValidAddress(tokenAddress) ? <><h3>Fractional investment · PROP-{id}</h3><InvestPanel propertyTokenAddress={tokenAddress} mockUSDCAddress={mockUSDCAddress} tokenSymbol={`PROP-${id}`} /></> : <div className="dao-section"><h3>Property token</h3><p className="panel-note">This property does not have a fractional token yet. Once the Exp8 factory is configured, the factory owner can create one here or token holders can approve a tokenization proposal.</p>
        {canCreate && <form onSubmit={createToken} className="inline-form"><div className="form-group"><label>Initial token supply</label><input type="number" min="1" value={supply} onChange={(e) => setSupply(e.target.value)} /></div><button className="btn btn-primary" disabled={loading}>{loading ? "Creating…" : `Create PROP-${id}`}</button></form>}
      </div>}
    </>}
  </section>;
}
