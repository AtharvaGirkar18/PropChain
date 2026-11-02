import React from "react";
import { formatEther } from "ethers";
import VoteBar from "./VoteBar";

export default function ProposalCard({ proposal, account, onVote, onExecute, busy }) {
  const active = Date.now() / 1000 < proposal.deadline;
  const total = window.BigInt(proposal.forVotes) + window.BigInt(proposal.againstVotes);
  const quorum = (window.BigInt(proposal.totalSupply) * window.BigInt(proposal.quorumBps)) / 10000n;
  const hasQuorum = total >= quorum;
  const approved = window.BigInt(proposal.forVotes) > window.BigInt(proposal.againstVotes);
  const status = proposal.executed ? "Executed" : active ? "Voting open" : hasQuorum && approved ? "Ready to execute" : "Voting closed";
  return <article className="proposal-card">
    <div className="proposal-card-head"><h3>Proposal #{proposal.id}</h3><span className="chip">{status}</span></div>
    <p>{proposal.description}</p>
    <small>Proposed by {proposal.proposer.slice(0, 8)}…{proposal.proposer.slice(-6)} · Deadline {new Date(proposal.deadline * 1000).toLocaleString()}</small>
    <VoteBar forVotes={Number(formatEther(proposal.forVotes))} againstVotes={Number(formatEther(proposal.againstVotes))} />
    <p className="proposal-quorum">Quorum: {Number(formatEther(total)).toLocaleString()} / {Number(formatEther(quorum)).toLocaleString()} DCE</p>
    {active && !proposal.hasVoted && account && <div className="proposal-actions"><button className="btn btn-primary" disabled={busy} onClick={() => onVote(proposal.id, true)}>Vote For</button><button className="btn btn-secondary" disabled={busy} onClick={() => onVote(proposal.id, false)}>Vote Against</button></div>}
    {active && proposal.hasVoted && <p className="meta">Your wallet has voted on this proposal.</p>}
    {!active && !proposal.executed && hasQuorum && approved && <button className="btn btn-primary" disabled={busy} onClick={() => onExecute(proposal.id)}>Execute Proposal</button>}
  </article>;
}
