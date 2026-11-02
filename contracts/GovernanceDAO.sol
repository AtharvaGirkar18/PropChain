// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDAOVotingToken {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @title GovernanceDAO
/// @notice Token-weighted proposals with a fixed voting window and permissionless execution.
/// @dev Voting weight is the voter's DCE balance when vote() is called (1 DCE = 1 vote).
contract GovernanceDAO {
    error ZeroAddress();
    error InvalidVotingPeriod();
    error InvalidQuorum();
    error EmptyDescription();
    error ProposalNotFound();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error NoVotingPower();
    error AlreadyExecuted();
    error QuorumNotReached();
    error MajorityNotReached();
    error ProposalExecutionFailed(bytes returnData);

    struct Proposal {
        address proposer;
        string description;
        address targetContract;
        bytes callData;
        uint64 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
    }

    IDAOVotingToken public immutable votingToken;
    uint64 public immutable votingPeriod;
    uint16 public immutable quorumBps;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address indexed targetContract, string description, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);

    constructor(address votingToken_, uint64 votingPeriod_, uint16 quorumBps_) {
        if (votingToken_ == address(0)) revert ZeroAddress();
        if (votingPeriod_ == 0) revert InvalidVotingPeriod();
        if (quorumBps_ == 0 || quorumBps_ > 10_000) revert InvalidQuorum();
        votingToken = IDAOVotingToken(votingToken_);
        votingPeriod = votingPeriod_;
        quorumBps = quorumBps_;
    }

    function createProposal(string calldata description, address targetContract, bytes calldata callData)
        external returns (uint256 proposalId)
    {
        if (bytes(description).length == 0) revert EmptyDescription();
        if (targetContract == address(0) && callData.length != 0) revert ZeroAddress();
        proposalId = ++proposalCount;
        uint256 deadline = block.timestamp + votingPeriod;
        proposals[proposalId] = Proposal(msg.sender, description, targetContract, callData, uint64(deadline), 0, 0, false);
        emit ProposalCreated(proposalId, msg.sender, targetContract, description, deadline);
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert ProposalNotFound();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        uint256 weight = votingToken.balanceOf(msg.sender);
        if (weight == 0) revert NoVotingPower();
        hasVoted[proposalId][msg.sender] = true;
        if (support) p.forVotes += weight;
        else p.againstVotes += weight;
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert ProposalNotFound();
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp < p.deadline) revert VotingStillOpen();
        uint256 totalVotes = p.forVotes + p.againstVotes;
        if (totalVotes * 10_000 < votingToken.totalSupply() * quorumBps) revert QuorumNotReached();
        if (p.forVotes <= p.againstVotes) revert MajorityNotReached();
        p.executed = true;
        if (p.targetContract != address(0)) {
            (bool success, bytes memory result) = p.targetContract.call(p.callData);
            if (!success) revert ProposalExecutionFailed(result);
        }
        emit ProposalExecuted(proposalId, msg.sender);
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer, string memory description, address targetContract, bytes memory callData,
        uint256 forVotes, uint256 againstVotes, uint256 deadline, bool executed
    ) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert ProposalNotFound();
        return (p.proposer, p.description, p.targetContract, p.callData, p.forVotes, p.againstVotes, p.deadline, p.executed);
    }
}
