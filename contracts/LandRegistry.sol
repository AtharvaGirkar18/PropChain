// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LandRegistry {
    
    // Owner/Admin of the contract
    address public admin;
    
    // Address of the authorized PropertyDispute contract
    address public propertyDisputeContract;
    
    // Counter for property IDs
    uint private propertyCounter = 1;
    
    // Property structure
    struct Property {
        uint id;
        address owner;
        string location;
        uint area; // in square meters
        uint price; // in Wei
        string documentHash; // IPFS hash of property documents
        bool disputed;
        uint timestamp;
    }
    
    // Mapping of property ID to Property struct
    mapping(uint => Property) public properties;
    
    // Mapping of property ID to ownership history (list of previous owners)
    mapping(uint => address[]) public ownershipHistory;
    
    // Mapping to check if a property ID exists
    mapping(uint => bool) public propertyExists;
    
    // Mapping to check if a document hash is already registered (prevent duplicates)
    mapping(string => bool) public documentHashExists;
    
    // Events
    event PropertyRegistered(
        uint indexed propertyId,
        address indexed owner,
        string location,
        uint area,
        uint price,
        string documentHash,
        uint timestamp
    );
    
    event OwnershipTransferred(
        uint indexed propertyId,
        address indexed previousOwner,
        address indexed newOwner,
        uint timestamp
    );
    
    event PropertyMarkedDisputed(
        uint indexed propertyId,
        address indexed markedBy,
        uint timestamp
    );
    
    event PropertyDisputeResolved(
        uint indexed propertyId,
        address indexed resolvedBy,
        uint timestamp
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier onlyAdminOrDisputeContract() {
        require(
            msg.sender == admin || msg.sender == propertyDisputeContract,
            "Only admin or PropertyDispute contract can call this function"
        );
        _;
    }
    
    modifier onlyPropertyOwner(uint _propertyId) {
        require(propertyExists[_propertyId], "Property does not exist");
        require(msg.sender == properties[_propertyId].owner, "You are not the owner of this property");
        _;
    }
    
    modifier propertyNotDisputed(uint _propertyId) {
        require(!properties[_propertyId].disputed, "Property is currently disputed");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerProperty(
        string memory _location,
        uint _area,
        uint _price,
        string memory _documentHash
    ) public {
        require(_area > 0, "Property area must be greater than 0");
        require(_price > 0, "Property price must be greater than 0");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(bytes(_documentHash).length > 0, "Document hash cannot be empty");
        require(!documentHashExists[_documentHash], "This document is already registered - possible duplicate");
        
        uint propertyId = propertyCounter;
        
        properties[propertyId] = Property({
            id: propertyId,
            owner: msg.sender,
            location: _location,
            area: _area,
            price: _price,
            documentHash: _documentHash,
            disputed: false,
            timestamp: block.timestamp
        });
        
        propertyExists[propertyId] = true;
        documentHashExists[_documentHash] = true;
        ownershipHistory[propertyId].push(msg.sender);
        
        emit PropertyRegistered(
            propertyId,
            msg.sender,
            _location,
            _area,
            _price,
            _documentHash,
            block.timestamp
        );
        
        propertyCounter++;
    }

    function transferOwnership(uint _propertyId, address _newOwner)
        public 
        onlyPropertyOwner(_propertyId) 
        propertyNotDisputed(_propertyId) 
    {
        require(_newOwner != address(0), "New owner address cannot be zero");
        require(_newOwner != msg.sender, "New owner must be different from current owner");
        require(propertyExists[_propertyId], "Property does not exist");
        
        address previousOwner = properties[_propertyId].owner;
        
        properties[_propertyId].owner = _newOwner;
        ownershipHistory[_propertyId].push(_newOwner);
        
        emit OwnershipTransferred(
            _propertyId,
            previousOwner,
            _newOwner,
            block.timestamp
        );
    }

    function getPropertyDetails(uint _propertyId)
        public 
        view 
        returns (Property memory) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        return properties[_propertyId];
    }

    function isPropertyDisputed(uint _propertyId)
        public 
        view 
        returns (bool) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        return properties[_propertyId].disputed;
    }

    function isTitleClean(uint _propertyId)
        public 
        view 
        returns (bool) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        return !properties[_propertyId].disputed;
    }

    function markPropertyDisputed(uint _propertyId)
        public 
        onlyAdminOrDisputeContract 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        
        // Only emit event if not already disputed (idempotent)
        if (!properties[_propertyId].disputed) {
            properties[_propertyId].disputed = true;
            
            emit PropertyMarkedDisputed(
                _propertyId,
                msg.sender,
                block.timestamp
            );
        }
    }

    function resolvePropertyDispute(uint _propertyId)
        public 
        onlyAdminOrDisputeContract 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        require(properties[_propertyId].disputed, "Property is not currently disputed");
        
        properties[_propertyId].disputed = false;
        
        emit PropertyDisputeResolved(
            _propertyId,
            msg.sender,
            block.timestamp
        );
    }

    function getOwnershipHistory(uint _propertyId)
        public 
        view 
        returns (address[] memory) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        return ownershipHistory[_propertyId];
    }

    function getPropertyCount()
        public 
        view 
        returns (uint) 
    {
        return propertyCounter - 1;
    }

    function setPropertyDisputeContract(address _propertyDisputeContract)
        public 
        onlyAdmin 
    {
        require(_propertyDisputeContract != address(0), "PropertyDispute contract address cannot be zero");
        propertyDisputeContract = _propertyDisputeContract;
    }

    /**
     * @dev Change admin (only by current admin)
     * @param _newAdmin Address of the new admin
     */
    function changeAdmin(address _newAdmin) 
        public 
        onlyAdmin 
    {
        require(_newAdmin != address(0), "New admin address cannot be zero");
        admin = _newAdmin;
    }
}
