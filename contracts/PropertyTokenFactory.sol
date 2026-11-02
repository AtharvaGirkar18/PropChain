// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PropertyToken.sol";

interface IPropertyOwnerRegistry {
    struct Property {
        uint256 id;
        address owner;
        bool disputed;
        string location;
        uint256 area;
        uint256 price;
        string documentHash;
        uint256 timestamp;
    }
    function getPropertyDetails(uint256 propertyId) external view returns (Property memory);
}

/// @title PropertyTokenFactory
/// @notice Deploys and indexes one fractional-ownership ERC-20 per registry property.
contract PropertyTokenFactory {
    error ZeroAddress();
    error Unauthorized();
    error TokenAlreadyCreated(uint256 propertyId);
    error InvalidPropertyId();
    error InvalidSupply();
    error InvalidPrice();
    error RegistryNotConfigured();

    address public owner;
    address public governanceDAO;
    address public landRegistry;
    address public immutable usdc;
    uint256 public defaultSupply;
    uint256 public defaultTokenPrice;
    mapping(uint256 => address) public propertyTokens;
    uint256[] private tokenizedPropertyIds;

    event PropertyTokenCreated(uint256 indexed propertyId, address indexed token, address indexed initialOwner, string name, string symbol, uint256 totalSupply);
    event GovernanceDAOUpdated(address indexed dao);
    event LandRegistryUpdated(address indexed registry);
    event DefaultsUpdated(uint256 supply, uint256 tokenPrice);

    modifier onlyOwnerOrDAO() {
        if (msg.sender != owner && msg.sender != governanceDAO) revert Unauthorized();
        _;
    }

    constructor(address usdc_, uint256 defaultSupply_, uint256 defaultTokenPrice_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (defaultSupply_ == 0) revert InvalidSupply();
        if (defaultTokenPrice_ == 0) revert InvalidPrice();
        owner = msg.sender;
        usdc = usdc_;
        defaultSupply = defaultSupply_;
        defaultTokenPrice = defaultTokenPrice_;
    }

    function createToken(uint256 propertyId, string calldata name, string calldata symbol, uint256 totalSupply)
        external onlyOwnerOrDAO returns (address tokenAddress)
    {
        if (landRegistry == address(0)) revert RegistryNotConfigured();
        address initialOwner;
        try IPropertyOwnerRegistry(landRegistry).getPropertyDetails(propertyId) returns (
            IPropertyOwnerRegistry.Property memory property
        ) { initialOwner = property.owner; }
        catch { revert InvalidPropertyId(); }
        tokenAddress = _createToken(propertyId, name, symbol, totalSupply, defaultTokenPrice, initialOwner);
    }

    /// @notice Optional callback for a newly deployed LandRegistry. Existing registries can use createToken directly.
    function createTokenFromRegistry(uint256 propertyId, address initialOwner) external returns (address tokenAddress) {
        if (msg.sender != landRegistry) revert Unauthorized();
        tokenAddress = _createToken(propertyId, string.concat("PropChain Property #", _toString(propertyId)), _symbol(propertyId), defaultSupply, defaultTokenPrice, initialOwner);
    }

    function _createToken(uint256 propertyId, string memory name, string memory symbol, uint256 totalSupply, uint256 price, address initialOwner)
        internal returns (address tokenAddress)
    {
        if (propertyId == 0) revert InvalidPropertyId();
        if (propertyTokens[propertyId] != address(0)) revert TokenAlreadyCreated(propertyId);
        if (initialOwner == address(0)) revert ZeroAddress();
        if (totalSupply == 0) revert InvalidSupply();
        if (price == 0) revert InvalidPrice();
        PropertyToken token = new PropertyToken(name, symbol, propertyId, totalSupply, price, usdc);
        tokenAddress = address(token);
        token.transfer(initialOwner, totalSupply);
        token.transferOwnership(initialOwner);
        propertyTokens[propertyId] = tokenAddress;
        tokenizedPropertyIds.push(propertyId);
        emit PropertyTokenCreated(propertyId, tokenAddress, initialOwner, name, symbol, totalSupply);
    }

    function getToken(uint256 propertyId) external view returns (address) { return propertyTokens[propertyId]; }

    function getAllTokens() external view returns (uint256[] memory propertyIds, address[] memory tokenAddresses) {
        uint256 length = tokenizedPropertyIds.length;
        propertyIds = new uint256[](length);
        tokenAddresses = new address[](length);
        for (uint256 i; i < length; ++i) {
            uint256 id = tokenizedPropertyIds[i];
            propertyIds[i] = id;
            tokenAddresses[i] = propertyTokens[id];
        }
    }

    function setGovernanceDAO(address dao) external {
        if (msg.sender != owner) revert Unauthorized();
        if (dao == address(0)) revert ZeroAddress();
        governanceDAO = dao;
        emit GovernanceDAOUpdated(dao);
    }

    function setLandRegistry(address registry) external {
        if (msg.sender != owner) revert Unauthorized();
        if (registry == address(0)) revert ZeroAddress();
        landRegistry = registry;
        emit LandRegistryUpdated(registry);
    }

    function setDefaults(uint256 supply, uint256 price) external {
        if (msg.sender != owner) revert Unauthorized();
        if (supply == 0) revert InvalidSupply();
        if (price == 0) revert InvalidPrice();
        defaultSupply = supply;
        defaultTokenPrice = price;
        emit DefaultsUpdated(supply, price);
    }

    function _symbol(uint256 id) private pure returns (string memory) { return string.concat("PROP-", _toString(id)); }
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value; uint256 digits;
        while (temp != 0) { ++digits; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { buffer[--digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }
}
