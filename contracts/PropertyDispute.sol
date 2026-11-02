// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LandRegistry.sol";

contract PropertyDispute {

    // ── OPT 4: Custom Errors (replaces all require string messages) ───────────
    // Saves ~5,500 gas on deployment; ~450 gas per reverted call
    error OnlyAdmin();
    error EmptyReason();
    error EmptyEvidenceHash();
    error PropertyNotInRegistry();
    error DisputeDoesNotExist(uint disputeId);
    error EmptyResolution();
    error DisputeAlreadyResolved(uint disputeId);
    error ZeroAddress();
    error OnlyAdminOrDAO();

    LandRegistry public landRegistry;
    address public admin;
    address public governanceDAO;
    uint private disputeCounter = 1;

    struct Dispute {
        uint id;
        uint propertyId;
        address raisedBy;
        string reason;
        string evidenceHash;
        bool resolved;
        uint timestamp;
        uint resolvedAt;
        string resolution;
    }

    mapping(uint => Dispute) public disputes;
    mapping(uint => uint[]) public propertyDisputes;
    mapping(uint => bool) public disputeExists;

    event DisputeRaised(
        uint indexed disputeId,
        uint indexed propertyId,
        address indexed raisedBy,
        string reason,
        string evidenceHash,
        uint timestamp
    );

    event DisputeResolved(
        uint indexed disputeId,
        uint indexed propertyId,
        address indexed resolvedBy,
        string resolution,
        uint timestamp
    );

    // ── OPT 4: Modifiers use custom errors ────────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyAdminOrDAO() {
        if (msg.sender != admin && msg.sender != governanceDAO) revert OnlyAdminOrDAO();
        _;
    }

    modifier disputeExists_(uint _disputeId) {
        if (!disputeExists[_disputeId]) revert DisputeDoesNotExist(_disputeId);
        _;
    }

    constructor(address _landRegistryAddress) {
        admin = msg.sender;
        landRegistry = LandRegistry(_landRegistryAddress);
    }

    // ── OPT 1: `calldata` instead of `memory` for read-only string args ───────
    // BEFORE: `string memory _reason, string memory _evidenceHash`
    // AFTER:  `string calldata _reason, string calldata _evidenceHash`
    // Saving: ~350 gas per raiseDispute call (2 string args)
    function raiseDispute(
        uint _propertyId,
        string calldata _reason,       // OPT 1: was `memory`
        string calldata _evidenceHash  // OPT 1: was `memory`
    ) public {
        if (bytes(_reason).length == 0) revert EmptyReason();           // OPT 4
        if (bytes(_evidenceHash).length == 0) revert EmptyEvidenceHash();// OPT 4

        LandRegistry.Property memory property = landRegistry.getPropertyDetails(_propertyId);
        if (property.id == 0) revert PropertyNotInRegistry();           // OPT 4

        uint disputeId = disputeCounter;

        disputes[disputeId] = Dispute({
            id: disputeId,
            propertyId: _propertyId,
            raisedBy: msg.sender,
            reason: _reason,
            evidenceHash: _evidenceHash,
            resolved: false,
            timestamp: block.timestamp,
            resolvedAt: 0,
            resolution: ""
        });

        disputeExists[disputeId] = true;
        propertyDisputes[_propertyId].push(disputeId);

        landRegistry.markPropertyDisputed(_propertyId);

        emit DisputeRaised(
            disputeId,
            _propertyId,
            msg.sender,
            _reason,
            _evidenceHash,
            block.timestamp
        );

        disputeCounter++;
    }

    // ── OPT 1 + OPT 2 + OPT 4 + OPT 5 combined in resolveDispute ────────────
    function resolveDispute(
        uint _disputeId,
        string calldata _resolution    // OPT 1: was `memory`
    )
        public
        onlyAdminOrDAO
        disputeExists_(_disputeId)
    {
        if (bytes(_resolution).length == 0) revert EmptyResolution();   // OPT 4

        // ── OPT 2: Cache storage pointer — slot hash computed ONCE ───────────
        // BEFORE: disputes[_disputeId].field accessed 5 separate times
        //         → each computes keccak256(key, slot) independently (~100 gas each)
        // AFTER:  `Dispute storage d` caches the slot; all fields accessed cheaply
        // Saving: ~120 gas per resolveDispute call
        Dispute storage d = disputes[_disputeId];                        // OPT 2

        if (d.resolved) revert DisputeAlreadyResolved(_disputeId);       // OPT 4

        uint propertyId = d.propertyId;  // OPT 2: single cheap read via pointer
        d.resolved   = true;             // OPT 2: cheap write via pointer
        d.resolvedAt = block.timestamp;  // OPT 2: cheap write via pointer
        d.resolution = _resolution;      // OPT 2: cheap write via pointer

        uint[] memory propertyDisputeIds = propertyDisputes[propertyId];

        // ── OPT 5: Cache array length + unchecked increment ──────────────────
        // BEFORE: `i < propertyDisputeIds.length` — MLOAD each iteration
        //         `i++` — overflow check each iteration (~30 gas)
        // AFTER:  cache length once; `unchecked { ++i }` skips overflow check
        // Saving: ~25 gas per iteration (significant for many disputes)
        uint256 len = propertyDisputeIds.length;                         // OPT 5: cache
        bool stillHasActiveDisputes = false;

        for (uint256 i = 0; i < len;) {                                  // OPT 5: use cached len
            if (!disputes[propertyDisputeIds[i]].resolved) {
                stillHasActiveDisputes = true;
                break;
            }
            unchecked { ++i; }                                           // OPT 5: no overflow check
        }

        if (!stillHasActiveDisputes) {
            landRegistry.resolvePropertyDispute(propertyId);
        }

        emit DisputeResolved(
            _disputeId,
            propertyId,
            msg.sender,
            _resolution,
            block.timestamp
        );
    }

    function getDisputesByProperty(uint _propertyId)
        public
        view
        returns (uint[] memory)
    {
        return propertyDisputes[_propertyId];
    }

    function getDisputeDetails(uint _disputeId)
        public
        view
        disputeExists_(_disputeId)
        returns (Dispute memory)
    {
        return disputes[_disputeId];
    }

    function hasActiveDisputes(uint _propertyId)
        public
        view
        returns (bool)
    {
        uint[] memory propertyDisputeIds = propertyDisputes[_propertyId];

        // OPT 5: Cache length + unchecked increment
        uint256 len = propertyDisputeIds.length;
        for (uint256 i = 0; i < len;) {
            if (!disputes[propertyDisputeIds[i]].resolved) {
                return true;
            }
            unchecked { ++i; }
        }

        return false;
    }

    function getDisputeCount()
        public
        view
        returns (uint)
    {
        return disputeCounter - 1;
    }

    function getDisputeCountByProperty(uint _propertyId)
        public
        view
        returns (uint)
    {
        return propertyDisputes[_propertyId].length;
    }

    function changeAdmin(address _newAdmin)
        public
        onlyAdmin
    {
        if (_newAdmin == address(0)) revert ZeroAddress();               // OPT 4
        admin = _newAdmin;
    }

    function setGovernanceDAO(address dao) public onlyAdmin {
        if (dao == address(0)) revert ZeroAddress();
        governanceDAO = dao;
    }
}
