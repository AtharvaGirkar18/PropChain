// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LandRegistry.sol";

contract PropertyDispute {
    
    // Reference to the LandRegistry contract
    LandRegistry public landRegistry;
    
    // Owner/Admin of the contract
    address public admin;
    
    // Counter for dispute IDs
    uint private disputeCounter = 1;
    
    // Dispute structure
    struct Dispute {
        uint id;
        uint propertyId;
        address raisedBy;
        string reason;
        string evidenceHash; // IPFS hash of evidence documents
        bool resolved;
        uint timestamp;
        uint resolvedAt;
        string resolution; // Details of how dispute was resolved
    }
    
    // Mapping of dispute ID to Dispute struct
    mapping(uint => Dispute) public disputes;
    
    // Mapping of property ID to array of dispute IDs
    mapping(uint => uint[]) public propertyDisputes;
    
    // Mapping to check if a dispute exists
    mapping(uint => bool) public disputeExists;
    
    // Events
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
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier disputeExists_(uint _disputeId) {
        require(disputeExists[_disputeId], "Dispute does not exist");
        _;
    }

    constructor(address _landRegistryAddress) {
        admin = msg.sender;
        landRegistry = LandRegistry(_landRegistryAddress);
    }

    function raiseDispute(uint _propertyId, string memory _reason, string memory _evidenceHash) public {
        require(bytes(_reason).length > 0, "Reason cannot be empty");
        require(bytes(_evidenceHash).length > 0, "Evidence hash cannot be empty");
        
        // Verify property exists in LandRegistry
        LandRegistry.Property memory property = landRegistry.getPropertyDetails(_propertyId);
        require(property.id != 0, "Property does not exist in registry");
        
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
        
        // Mark the property as disputed in LandRegistry
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

    function resolveDispute(uint _disputeId, string memory _resolution)
        public 
        onlyAdmin 
        disputeExists_(_disputeId) 
    {
        require(bytes(_resolution).length > 0, "Resolution cannot be empty");
        require(!disputes[_disputeId].resolved, "Dispute is already resolved");
        
        uint propertyId = disputes[_disputeId].propertyId;
        
        disputes[_disputeId].resolved = true;
        disputes[_disputeId].resolvedAt = block.timestamp;
        disputes[_disputeId].resolution = _resolution;
        
        // Check if there are any remaining active disputes
        uint[] memory propertyDisputeIds = propertyDisputes[propertyId];
        bool stillHasActiveDisputes = false;
        
        for (uint i = 0; i < propertyDisputeIds.length; i++) {
            if (!disputes[propertyDisputeIds[i]].resolved) {
                stillHasActiveDisputes = true;
                break;
            }
        }
        
        // Only mark property as not disputed if all disputes are resolved
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
        
        for (uint i = 0; i < propertyDisputeIds.length; i++) {
            if (!disputes[propertyDisputeIds[i]].resolved) {
                return true;
            }
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
        require(_newAdmin != address(0), "New admin address cannot be zero");
        admin = _newAdmin;
    }
}
