// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LiquidityPool
 * @notice Constant-Product Automated Market Maker (x * y = k) for DecentraEstate.
 *         Pairs fractional PropertyToken with MockUSDC.
 *
 *  Key capabilities:
 *   1. addLiquidity(amountA, amountB):
 *      Deposits tokenA and tokenB, automatically enforces the pool ratio,
 *      and mints proportional LP tokens to the provider.
 *   2. removeLiquidity(lpAmount):
 *      Burns LP tokens and returns the proportional amounts of tokenA and tokenB.
 *   3. getReserves():
 *      Returns current reserves (reserveA, reserveB, lastBlockTimestamp).
 *   4. quote(amountA, reserveA, reserveB):
 *      Calculates equivalent amountB given amountA at current pool reserves.
 *   5. getAmountOut(amountIn, tokenIn):
 *      Constant-product swap quote with 0.3% LP fee.
 *   6. swap(amountIn, minAmountOut, tokenIn, to):
 *      Executes token swap directly against the pool reserves.
 *
 * Experiment 4 — AMM Liquidity Pool
 */
contract LiquidityPool is ERC20, ReentrancyGuard, Ownable {

    // ── Custom errors ─────────────────────────────────────────────────────────
    error ZeroAddress();
    error IdenticalTokens();
    error ZeroAmount();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientOutputAmount();
    error InsufficientLiquidity();
    error InvalidToken();
    error TransferFailed();

    // ── Immutables ────────────────────────────────────────────────────────────
    IERC20 public immutable tokenA; // e.g. PropertyToken (18 decimals)
    IERC20 public immutable tokenB; // e.g. MockUSDC (6 decimals)

    /// @dev Minimum liquidity permanently locked on initial deposit to protect against pool inflation
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // ── State ─────────────────────────────────────────────────────────────────
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public lastBlockTimestamp;

    // ── Events ────────────────────────────────────────────────────────────────
    event Mint(address indexed sender, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Burn(address indexed sender, uint256 amountA, uint256 amountB, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amountIn,
        address indexed tokenIn,
        uint256 amountOut,
        address indexed tokenOut,
        address to
    );
    event Sync(uint256 reserveA, uint256 reserveB);

    // ── Constructor ───────────────────────────────────────────────────────────
    /**
     * @param _tokenA Address of Token A (PropertyToken)
     * @param _tokenB Address of Token B (MockUSDC)
     */
    constructor(address _tokenA, address _tokenB)
        ERC20("DecentraEstate PROP-USDC LP", "LP-PROP")
        Ownable(msg.sender)
    {
        if (_tokenA == address(0) || _tokenB == address(0)) revert ZeroAddress();
        if (_tokenA == _tokenB) revert IdenticalTokens();

        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // ── Liquidity Management ──────────────────────────────────────────────────

    /**
     * @notice Add liquidity to the pool.
     *         On first deposit, sets the initial exchange ratio.
     *         On subsequent deposits, tokens are added in proportion to existing reserves.
     * @param amountADesired Target amount of tokenA to deposit.
     * @param amountBDesired Target amount of tokenB to deposit.
     * @return actualA Actual amount of tokenA transferred.
     * @return actualB Actual amount of tokenB transferred.
     * @return liquidity Amount of LP tokens minted to the caller.
     */
    function addLiquidity(uint256 amountADesired, uint256 amountBDesired)
        external
        nonReentrant
        returns (uint256 actualA, uint256 actualB, uint256 liquidity)
    {
        if (amountADesired == 0 || amountBDesired == 0) revert ZeroAmount();

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        if (_reserveA == 0 && _reserveB == 0) {
            // First provider establishes initial ratio
            actualA = amountADesired;
            actualB = amountBDesired;

            // Geometric mean for initial LP tokens (Uniswap v2 formula)
            uint256 initialLiquidity = _sqrt(actualA * actualB);
            if (initialLiquidity <= MINIMUM_LIQUIDITY) revert InsufficientLiquidityMinted();

            // Lock minimum liquidity to prevent zero-division / inflation exploit
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
            liquidity = initialLiquidity - MINIMUM_LIQUIDITY;
        } else {
            // Optimal deposit ratio calculation
            uint256 amountBOptimal = quote(amountADesired, _reserveA, _reserveB);
            if (amountBOptimal <= amountBDesired) {
                actualA = amountADesired;
                actualB = amountBOptimal;
            } else {
                uint256 amountAOptimal = quote(amountBDesired, _reserveB, _reserveA);
                assert(amountAOptimal <= amountADesired);
                actualA = amountAOptimal;
                actualB = amountBDesired;
            }

            uint256 totalLP = totalSupply();
            uint256 lpFromA = (actualA * totalLP) / _reserveA;
            uint256 lpFromB = (actualB * totalLP) / _reserveB;
            liquidity = lpFromA < lpFromB ? lpFromA : lpFromB;
        }

        if (liquidity == 0) revert InsufficientLiquidityMinted();

        // Pull tokens from user
        bool okA = tokenA.transferFrom(msg.sender, address(this), actualA);
        if (!okA) revert TransferFailed();

        bool okB = tokenB.transferFrom(msg.sender, address(this), actualB);
        if (!okB) revert TransferFailed();

        // Mint LP tokens to provider
        _mint(msg.sender, liquidity);

        // Update reserves
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));

        emit Mint(msg.sender, actualA, actualB, liquidity);
    }

    /**
     * @notice Remove liquidity by burning LP tokens.
     * @param lpAmount Quantity of LP tokens to burn.
     * @return amountA Amount of tokenA returned.
     * @return amountB Amount of tokenB returned.
     */
    function removeLiquidity(uint256 lpAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        if (lpAmount == 0) revert ZeroAmount();

        uint256 totalLP = totalSupply();
        if (totalLP == 0) revert InsufficientLiquidity();

        uint256 balA = tokenA.balanceOf(address(this));
        uint256 balB = tokenB.balanceOf(address(this));

        // Proportional withdrawal
        amountA = (lpAmount * balA) / totalLP;
        amountB = (lpAmount * balB) / totalLP;

        if (amountA == 0 || amountB == 0) revert InsufficientLiquidityBurned();

        // Burn caller's LP tokens
        _burn(msg.sender, lpAmount);

        // Transfer pool assets back to user
        bool okA = tokenA.transfer(msg.sender, amountA);
        if (!okA) revert TransferFailed();

        bool okB = tokenB.transfer(msg.sender, amountB);
        if (!okB) revert TransferFailed();

        // Update reserves
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));

        emit Burn(msg.sender, amountA, amountB, msg.sender);
    }

    // ── Swapping & AMM Pricing ────────────────────────────────────────────────

    /**
     * @notice Swaps an exact amount of tokenIn for tokenOut using constant product formula.
     *         Incorporates a 0.3% LP trading fee.
     * @param amountIn Amount of input token to swap.
     * @param minAmountOut Slippage protection threshold.
     * @param tokenIn Address of the token to spend (tokenA or tokenB).
     * @param to Recipient address for the output tokens.
     * @return amountOut Amount of output token sent to recipient.
     */
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        address tokenIn,
        address to
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (tokenIn != address(tokenA) && tokenIn != address(tokenB)) revert InvalidToken();

        bool isTokenA = tokenIn == address(tokenA);
        (IERC20 inToken, IERC20 outToken, uint256 resIn, uint256 resOut) = isTokenA
            ? (tokenA, tokenB, reserveA, reserveB)
            : (tokenB, tokenA, reserveB, reserveA);

        if (resIn == 0 || resOut == 0) revert InsufficientLiquidity();

        amountOut = getAmountOut(amountIn, resIn, resOut);
        if (amountOut < minAmountOut) revert InsufficientOutputAmount();

        // Transfer tokenIn from user
        bool okIn = inToken.transferFrom(msg.sender, address(this), amountIn);
        if (!okIn) revert TransferFailed();

        // Transfer tokenOut to recipient
        bool okOut = outToken.transfer(to, amountOut);
        if (!okOut) revert TransferFailed();

        // Update reserves
        _update(tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));

        emit Swap(msg.sender, amountIn, tokenIn, amountOut, address(outToken), to);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Read-only current reserves and last sync timestamp.
     */
    function getReserves()
        external
        view
        returns (uint256 _reserveA, uint256 _reserveB, uint256 _lastBlockTimestamp)
    {
        return (reserveA, reserveB, lastBlockTimestamp);
    }

    /**
     * @notice Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset.
     */
    function quote(uint256 amountAIn, uint256 _reserveA, uint256 _reserveB)
        public
        pure
        returns (uint256 amountBOut)
    {
        if (amountAIn == 0) revert ZeroAmount();
        if (_reserveA == 0 || _reserveB == 0) revert InsufficientLiquidity();
        amountBOut = (amountAIn * _reserveB) / _reserveA;
    }

    /**
     * @notice Given input amount and reserves, returns output amount after 0.3% fee.
     *         Formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
     */
    function getAmountOut(uint256 amountIn, uint256 resIn, uint256 resOut)
        public
        pure
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (resIn == 0 || resOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * resOut;
        uint256 denominator = (resIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @notice Helper to preview swap output by specifying tokenIn address.
     */
    function getSwapQuote(uint256 amountIn, address tokenIn)
        external
        view
        returns (uint256 amountOut)
    {
        if (tokenIn != address(tokenA) && tokenIn != address(tokenB)) revert InvalidToken();
        bool isTokenA = tokenIn == address(tokenA);
        (uint256 resIn, uint256 resOut) = isTokenA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);
        return getAmountOut(amountIn, resIn, resOut);
    }

    /**
     * @notice Returns constant k = reserveA * reserveB
     */
    function kLast() external view returns (uint256) {
        return reserveA * reserveB;
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    function _update(uint256 balanceA, uint256 balanceB) internal {
        reserveA = balanceA;
        reserveB = balanceB;
        lastBlockTimestamp = block.timestamp;
        emit Sync(reserveA, reserveB);
    }

    /**
     * @dev Babylonian square root calculation (Uniswap v2 formula)
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
