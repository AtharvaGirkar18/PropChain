// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISecurePair {
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function getReserves() external view returns (uint256, uint256, uint256);
}

interface ISecureFlashLoanReceiver {
    function onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes calldata data)
        external returns (bytes32);
}

/// @title SecurePool
/// @notice Lending-pool counterpart with reentrancy protection, CEI, health checks,
///         a fresh trusted reference price, and standard flash-loan repayment checks.
/// @dev The trusted price is deliberately operator-supplied for this testnet lab; it
///      must represent loan-token base units per whole 18-decimal collateral token.
contract SecurePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPair();
    error InvalidPrice();
    error StalePrice();
    error InsufficientLiquidity();
    error InvalidCallback();
    error FlashLoanNotRepaid();
    error InsufficientCollateral();
    error UnsupportedChain();

    uint256 public constant LTV_BPS = 5_000;
    uint256 public constant FLASH_FEE_BPS = 9;
    uint256 public constant MAX_PRICE_AGE = 1 days;
    bytes32 public constant CALLBACK_SUCCESS = keccak256("PropChainFlashLoan.onFlashLoan");

    IERC20 public immutable loanToken;
    IERC20 public immutable collateralToken;
    ISecurePair public immutable ammPool;
    uint256 public trustedCollateralPrice;
    uint256 public priceUpdatedAt;
    mapping(address => uint256) public collateralBalance;
    mapping(address => uint256) public borrowed;

    event PoolFunded(address indexed provider, uint256 amount);
    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 trustedPrice);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event FlashLoan(address indexed receiver, uint256 amount, uint256 fee);
    event TrustedPriceUpdated(uint256 price, uint256 updatedAt);

    constructor(address loanToken_, address collateralToken_, address ammPool_, uint256 initialTrustedPrice)
        Ownable(msg.sender)
    {
        if (!_supportedChain()) revert UnsupportedChain();
        if (loanToken_ == address(0) || collateralToken_ == address(0) || ammPool_ == address(0)) revert ZeroAddress();
        if (initialTrustedPrice == 0) revert InvalidPrice();
        loanToken = IERC20(loanToken_);
        collateralToken = IERC20(collateralToken_);
        ammPool = ISecurePair(ammPool_);
        address a = ammPool.tokenA();
        address b = ammPool.tokenB();
        if (!((a == loanToken_ && b == collateralToken_) || (a == collateralToken_ && b == loanToken_))) revert InvalidPair();
        trustedCollateralPrice = initialTrustedPrice;
        priceUpdatedAt = block.timestamp;
        emit TrustedPriceUpdated(initialTrustedPrice, block.timestamp);
    }

    function _supportedChain() private view returns (bool) {
        uint256 id = block.chainid;
        return id == 11155111 || id == 80002 || id == 31337 || id == 1337 || id == 5777;
    }

    function fund(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        loanToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function setTrustedPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        trustedCollateralPrice = newPrice;
        priceUpdatedAt = block.timestamp;
        emit TrustedPriceUpdated(newPrice, block.timestamp);
    }

    function getCollateralPrice() public view returns (uint256) {
        if (trustedCollateralPrice == 0) revert InvalidPrice();
        if (block.timestamp - priceUpdatedAt > MAX_PRICE_AGE) revert StalePrice();
        return trustedCollateralPrice;
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 price = getCollateralPrice();
        uint256 maxBorrow = (collateralBalance[msg.sender] * price * LTV_BPS) / (1e18 * 10_000);
        if (borrowed[msg.sender] + amount > maxBorrow) revert InsufficientCollateral();
        borrowed[msg.sender] += amount; // Effects before external token transfer.
        loanToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, price);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > collateralBalance[msg.sender]) revert InsufficientCollateral();
        uint256 remaining = collateralBalance[msg.sender] - amount;
        uint256 maxBorrow = (remaining * getCollateralPrice() * LTV_BPS) / (1e18 * 10_000);
        if (borrowed[msg.sender] > maxBorrow) revert InsufficientCollateral();
        collateralBalance[msg.sender] = remaining; // Checks-effects-interactions + health check.
        collateralToken.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function flashLoan(address receiver, uint256 amount, bytes calldata data) external nonReentrant {
        if (receiver == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = loanToken.balanceOf(address(this));
        if (amount > balanceBefore) revert InsufficientLiquidity();
        uint256 fee = (amount * FLASH_FEE_BPS) / 10_000;
        loanToken.safeTransfer(receiver, amount);
        bytes32 result = ISecureFlashLoanReceiver(receiver).onFlashLoan(msg.sender, address(loanToken), amount, fee, data);
        if (result != CALLBACK_SUCCESS) revert InvalidCallback();
        if (loanToken.balanceOf(address(this)) < balanceBefore + fee) revert FlashLoanNotRepaid();
        emit FlashLoan(receiver, amount, fee);
    }
}
