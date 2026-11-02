import React, { useCallback, useEffect, useState } from "react";
import { Contract } from "ethers";
import DAO_ABI from "../abis/GovernanceDAO.json";
import { hasValidAddress } from "../config/contracts";
import { useWallet } from "../context/WalletContext";
import DisputePanel from "../components/DisputePanel";
import CreateProposal from "../components/CreateProposal";
import ProposalCard from "../components/ProposalCard";

export default function Governance({ account, landRegistryAddress, propertyDisputeAddress, governanceDAOAddress, factoryAddress, onError, onSuccess }) {
  const { provider, signer } = useWallet();
  const [proposals, setProposals] = useState([]);
  const [totalSupply, setTotalSupply] = useState(0n);
  const [quorumBps, setQuorumBps] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const configured = hasValidAddress(governanceDAOAddress);
  const refresh = useCallback(async () => {
    if (!configured || !provider) { setProposals([]); return; }
    let operation = "read DAO proposalCount()";
    try {
      const dao = new Contract(governanceDAOAddress, DAO_ABI.abi, provider);
      const count = await dao.proposalCount();
      operation = "read DAO quorumBps()";
      const bps = await dao.quorumBps();
      operation = "read DAO votingToken()";
      const tokenAddress = await dao.votingToken();
      const token = new Contract(tokenAddress, ["function totalSupply() view returns (uint256)"], provider);
      operation = `read DCE totalSupply() at ${tokenAddress}`;
      const supply = await token.totalSupply();
      setQuorumBps(Number(bps)); setTotalSupply(supply);
      const rows = [];
      for (let id = 1n; id <= count; id += 1n) {
        operation = `read DAO getProposal(${id})`;
        const p = await dao.getProposal(id);
        let voted = false;
        if (account) {
          operation = `read DAO hasVoted(${id}, ${account})`;
          voted = await dao.hasVoted(id, account);
        }
        rows.push({ id: Number(id), proposer: p.proposer, description: p.description, targetContract: p.targetContract, callData: p.callData,
          forVotes: p.forVotes, againstVotes: p.againstVotes, deadline: Number(p.deadline), executed: p.executed, hasVoted: Boolean(voted), totalSupply: supply, quorumBps: Number(bps) });
      }
      setProposals(rows.reverse());
    } catch (e) {
      setProposals([]);
      onError(`Could not ${operation}: ${e.shortMessage || e.message || "unknown error"}`);
    }
  }, [configured, provider, governanceDAOAddress, account, onError]);
  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  const vote = async (id, support) => {
    setBusy(true);
    try { const tx = await new Contract(governanceDAOAddress, DAO_ABI.abi, signer).vote(id, support); await tx.wait(); onSuccess("Vote recorded on-chain."); setRefreshKey((v) => v + 1); }
    catch (e) { onError(e.shortMessage || e.message || "Vote failed."); }
    finally { setBusy(false); }
  };
  const execute = async (id) => {
    setBusy(true);
    try { const tx = await new Contract(governanceDAOAddress, DAO_ABI.abi, signer).executeProposal(id); await tx.wait(); onSuccess("Proposal executed successfully."); setRefreshKey((v) => v + 1); }
    catch (e) { onError(e.shortMessage || e.message || "Proposal execution failed."); }
    finally { setBusy(false); }
  };

  return <section className="panel">
    <h2>Governance &amp; Disputes</h2>
    <p className="panel-note">DCE holders create proposals and vote with their DCE balance. Successful proposals can execute authorized on-chain actions after voting closes.</p>
    <section className="dao-section">
      <h3>Community DAO</h3>
      {!configured ? <div className="alert alert-info">DAO is not deployed/configured on this network yet. Existing dispute tools remain available. Add the Exp8 addresses in contracts.js after deploying from Remix.</div> : <>
        <CreateProposal daoAddress={governanceDAOAddress} factoryAddress={factoryAddress} disputeAddress={propertyDisputeAddress} account={account} onSuccess={onSuccess} onError={onError} onCreated={() => setRefreshKey((v) => v + 1)} />
        <div className="proposal-list"><h3>Proposals</h3>{proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={{ ...proposal, totalSupply, quorumBps }} account={account} onVote={vote} onExecute={execute} busy={busy} />)}
          {!proposals.length && <p className="meta">No proposals have been created.</p>}</div>
      </>}
    </section>
    <h3>Property Disputes</h3>
    <DisputePanel account={account} landRegistryAddress={landRegistryAddress} propertyDisputeAddress={propertyDisputeAddress} onError={onError} onSuccess={onSuccess} />
  </section>;
}
