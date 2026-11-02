// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVulnerableSpotAMM {
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function getReserves() external view returns (uint256, uint256, uint256);
    function swap(uint256 amountIn, uint256 minAmountOut, address tokenIn, address to) external returns (uint256);
}

interface IFlashLoanReceiver {
    function onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes calldata data)
        external returns (bytes32);
}

/// @title VulnerablePool
/// @notice Educational lending pool that trusts a manipulable AMM spot price.
/// @dev Intentionally unsafe: flash loans are composable, borrow uses spot reserves,
///      and collateral can be withdrawn while debt remains.
contract VulnerablePool is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPair();
    error InsufficientLiquidity();
    error InvalidCallback();
    error FlashLoanNotRepaid();
    error InsufficientCollateral();
    error TransferFailed();
    error UnsupportedChain();

    uint256 public constant LTV_BPS = 5_000;
    uint256 public constant FLASH_FEE_BPS = 9;
    bytes32 public constant CALLBACK_SUCCESS = keccak256("PropChainFlashLoan.onFlashLoan");

    IERC20 public immutable loanToken;
    IERC20 public immutable collateralToken;
    IVulnerableSpotAMM public immutable ammPool;
    mapping(address => uint256) public collateralBalance;
    mapping(address => uint256) public borrowed;

    event PoolFunded(address indexed provider, uint256 amount);
    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 spotPrice);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event FlashLoan(address indexed receiver, uint256 amount, uint256 fee);

    constructor(address loanToken_, address collateralToken_, address ammPool_) Ownable(msg.sender) {
        if (!_supportedChain()) revert UnsupportedChain();
        if (loanToken_ == address(0) || collateralToken_ == address(0) || ammPool_ == address(0)) revert ZeroAddress();
        loanToken = IERC20(loanToken_);
        collateralToken = IERC20(collateralToken_);
        ammPool = IVulnerableSpotAMM(ammPool_);
        address a = ammPool.tokenA();
        address b = ammPool.tokenB();
        if (!((a == loanToken_ && b == collateralToken_) || (a == collateralToken_ && b == loanToken_))) revert InvalidPair();
    }

    function _supportedChain() private view returns (bool) {
        uint256 id = block.chainid;
        return id == 11155111 || id == 80002 || id == 31337 || id == 1337 || id == 5777;
    }

    /// @notice Owner deposits lendable assets. Approve this contract first.
    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        loanToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Vulnerability: collateral is valued using the current AMM reserve ratio.
    function getCollateralPrice() public view returns (uint256 price) {
        (uint256 reserveA, uint256 reserveB,) = ammPool.getReserves();
        address a = ammPool.tokenA();
        address b = ammPool.tokenB();
        uint256 reserveLoan = a == address(loanToken) ? reserveA : reserveB;
        uint256 reserveCollateral = a == address(collateralToken) ? reserveA : reserveB;
        if (reserveLoan == 0 || reserveCollateral == 0) revert InsufficientLiquidity();
        // Assumes 18-decimal collateral: result is loan-token base units per whole collateral token.
        price = (reserveLoan * 1e18) / reserveCollateral;
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 price = getCollateralPrice();
        uint256 maxBorrow = (collateralBalance[msg.sender] * price * LTV_BPS) / (1e18 * 10_000);
        if (borrowed[msg.sender] + amount > maxBorrow) revert InsufficientCollateral();
        // Intentionally transfers before recording the debt (CEI violation for unsafe tokens).
        loanToken.safeTransfer(msg.sender, amount);
        borrowed[msg.sender] += amount;
        emit Borrowed(msg.sender, amount, price);
    }

    /// @notice Vulnerability: permits the borrower to remove all collateral despite outstanding debt.
    function withdrawCollateral(uint256 amount) external {
        if (amount == 0 || amount > collateralBalance[msg.sender]) revert InsufficientCollateral();
        collateralToken.safeTransfer(msg.sender, amount);
        collateralBalance[msg.sender] -= amount;
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Unprotected flash loan used by the educational attacker contract.
    function flashLoan(address receiver, uint256 amount, bytes calldata data) external {
        if (receiver == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = loanToken.balanceOf(address(this));
        if (amount > balanceBefore) revert InsufficientLiquidity();
        uint256 fee = (amount * FLASH_FEE_BPS) / 10_000;
        loanToken.safeTransfer(receiver, amount);
        bytes32 result = IFlashLoanReceiver(receiver).onFlashLoan(msg.sender, address(loanToken), amount, fee, data);
        if (result != CALLBACK_SUCCESS) revert InvalidCallback();
        // Intentional vulnerability: this checks only the flash amount, not the
        // pool's pre-loan balance. Nested borrowing can drain pool liquidity while
        // the flash principal still appears repaid.
        if (loanToken.balanceOf(address(this)) < amount + fee) revert FlashLoanNotRepaid();
        emit FlashLoan(receiver, amount, fee);
    }
}
