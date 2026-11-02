// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPropertyTokenFactoryCallback {
    function createTokenFromRegistry(uint256 propertyId, address initialOwner) external returns (address);
}

contract LandRegistry {

    // ── OPT 4: Custom Errors (replaces all require string messages) ───────────
    // Saves ~5,500 gas on deployment; ~450 gas per reverted call
    error OnlyAdmin();
    error OnlyAdminOrDisputeContract();
    error NotPropertyOwner(uint propertyId);
    error PropertyDoesNotExist(uint propertyId);
    error PropertyIsDisputed(uint propertyId);
    error InvalidArea();
    error InvalidPrice();
    error EmptyLocation();
    error EmptyDocumentHash();
    error DuplicateDocument();
    error ZeroAddress();
    error SameOwner();
    error PropertyNotInDispute(uint propertyId);
    error ZeroDisputeContractAddress();

    address public admin;
    address public propertyDisputeContract;
    address public propertyTokenFactory;
    uint private propertyCounter = 1;

    // ── OPT 3: Tight Struct Packing ──────────────────────────────────────────
    // BEFORE: `bool disputed` was placed after `string documentHash` — its own slot
    // AFTER:  `bool disputed` moved immediately after `address owner` (20 bytes).
    //         20-byte address + 1-byte bool = 21 bytes → share ONE 32-byte slot.
    //         Saves 1 SSTORE (~20,000 gas) on every new property registration.
    struct Property {
        uint id;
        address owner;
        bool disputed;       // ← packed with `owner` in same storage slot (OPT 3)
        string location;
        uint area;
        uint price;
        string documentHash;
        uint timestamp;
    }

    mapping(uint => Property) public properties;
    mapping(uint => address[]) public ownershipHistory;
    mapping(uint => bool) public propertyExists;
    mapping(string => bool) public documentHashExists;

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

    // ── OPT 4: Modifiers now use custom errors ────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyAdminOrDisputeContract() {
        if (msg.sender != admin && msg.sender != propertyDisputeContract)
            revert OnlyAdminOrDisputeContract();
        _;
    }

    modifier onlyPropertyOwner(uint _propertyId) {
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
        if (msg.sender != properties[_propertyId].owner)
            revert NotPropertyOwner(_propertyId);
        _;
    }

    modifier propertyNotDisputed(uint _propertyId) {
        if (properties[_propertyId].disputed) revert PropertyIsDisputed(_propertyId);
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ── OPT 1: `calldata` instead of `memory` for read-only string args ───────
    // BEFORE: `string memory _location, string memory _documentHash`
    //         → EVM copies calldata bytes into memory (~200-400 gas per string)
    // AFTER:  `string calldata _location, string calldata _documentHash`
    //         → reads directly from calldata, zero-copy overhead
    // Saving: ~350 gas per registerProperty call (2 string args)
    function registerProperty(
        string calldata _location,   // OPT 1: was `memory`
        uint _area,
        uint _price,
        string calldata _documentHash // OPT 1: was `memory`
    ) public {
        if (_area == 0) revert InvalidArea();                            // OPT 4
        if (_price == 0) revert InvalidPrice();                          // OPT 4
        if (bytes(_location).length == 0) revert EmptyLocation();        // OPT 4
        if (bytes(_documentHash).length == 0) revert EmptyDocumentHash();// OPT 4
        if (documentHashExists[_documentHash]) revert DuplicateDocument();// OPT 4

        uint propertyId = propertyCounter;

        properties[propertyId] = Property({
            id: propertyId,
            owner: msg.sender,
            disputed: false,          // OPT 3: sits in same slot as `owner`
            location: _location,
            area: _area,
            price: _price,
            documentHash: _documentHash,
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

        // Optional Exp 8 integration. Existing deployments keep this unset and
        // remain compatible; the frontend can tokenize properties via the factory.
        if (propertyTokenFactory != address(0)) {
            IPropertyTokenFactoryCallback(propertyTokenFactory).createTokenFromRegistry(propertyId, msg.sender);
        }
    }

    function transferOwnership(uint _propertyId, address _newOwner)
        public
        onlyPropertyOwner(_propertyId)
        propertyNotDisputed(_propertyId)
    {
        if (_newOwner == address(0)) revert ZeroAddress();              // OPT 4
        if (_newOwner == msg.sender) revert SameOwner();                // OPT 4
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId); // OPT 4

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
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
        return properties[_propertyId];
    }

    function isPropertyDisputed(uint _propertyId)
        public
        view
        returns (bool)
    {
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
        return properties[_propertyId].disputed;
    }

    function isTitleClean(uint _propertyId)
        public
        view
        returns (bool)
    {
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
        return !properties[_propertyId].disputed;
    }

    function markPropertyDisputed(uint _propertyId)
        public
        onlyAdminOrDisputeContract
    {
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);

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
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
        if (!properties[_propertyId].disputed) revert PropertyNotInDispute(_propertyId);

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
        if (!propertyExists[_propertyId]) revert PropertyDoesNotExist(_propertyId);
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
        if (_propertyDisputeContract == address(0)) revert ZeroDisputeContractAddress();
        propertyDisputeContract = _propertyDisputeContract;
    }

    function setPropertyTokenFactory(address factory) public onlyAdmin {
        if (factory == address(0)) revert ZeroAddress();
        propertyTokenFactory = factory;
    }

    /**
     * @dev Change admin (only by current admin)
     * @param _newAdmin Address of the new admin
     */
    function changeAdmin(address _newAdmin)
        public
        onlyAdmin
    {
        if (_newAdmin == address(0)) revert ZeroAddress();              // OPT 4
        admin = _newAdmin;
    }
}
