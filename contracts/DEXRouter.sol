// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Minimal interface for any LiquidityPool in the ecosystem.
 */
interface ILiquidityPool {
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        address tokenIn,
        address to
    ) external returns (uint256 amountOut);

    function getAmountOut(
        uint256 amountIn,
        uint256 resIn,
        uint256 resOut
    ) external pure returns (uint256 amountOut);

    function getReserves()
        external
        view
        returns (uint256 reserveA, uint256 reserveB, uint256 lastBlockTimestamp);

    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
}

/**
 * @title DEXRouter  (v2 — Multi-Pool / Multi-Hop)
 * @notice Uniswap V2-style routing layer for the DecentraEstate AMM ecosystem.
 *
 *  Capabilities:
 *  ─────────────
 *  • Registers any number of LiquidityPool contracts at construction time.
 *  • Maintains a pool-registry mapping: token0 → token1 → pool address (bidirectional).
 *  • `swapExactTokensForTokens` supports paths of ANY length ≥ 2:
 *      - Length 2 → single-hop:  PROP → mUSDC   (direct pool)
 *      - Length 3 → two-hop:    PROP → mUSDC → DCE  (two pools, intermediate held by router)
 *  • On-chain deadline enforcement (EIP-2612-compatible pattern).
 *  • On-chain slippage enforcement via `amountOutMin`.
 *  • View helpers `getAmountsOut` and `getAmountOut` for frontend quoting.
 *
 *  Supported pools (registered at deployment):
 *  ────────────────────────────────────────────
 *  Pool 0 — PROP / mUSDC  (Experiment 4)
 *  Pool 1 — DCE  / mUSDC  (Experiment 6)
 *
 *  Multi-hop example (PROP → DCE):
 *  ─────────────────────────────────
 *  path = [PROP, mUSDC, DCE]
 *  1. Pull PROP from user → router
 *  2. Hop 1: router approves Pool0, calls Pool0.swap(PROP→mUSDC), mUSDC lands in router
 *  3. Hop 2: router approves Pool1, calls Pool1.swap(mUSDC→DCE), DCE lands at `to`
 *  4. Check final output ≥ amountOutMin
 *
 * Experiment 6 — DEX Prototype
 */
contract DEXRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Pool Registry ─────────────────────────────────────────────────────────
    /// @notice getPool[tokenA][tokenB] = pool address (registered bidirectionally)
    mapping(address => mapping(address => address)) public getPool;

    // ── Events ────────────────────────────────────────────────────────────────
    event SwapExecuted(
        address indexed sender,
        address[] path,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );

    event PoolRegistered(address indexed pool, address indexed tokenA, address indexed tokenB);

    // ── Custom Errors ─────────────────────────────────────────────────────────
    error DeadlineExpired();
    error InvalidPath();
    error InsufficientOutputAmount(uint256 amountOut, uint256 amountOutMin);
    error PoolNotFound(address tokenIn, address tokenOut);
    error ZeroAmount();
    error ZeroAddress();

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param pools Array of LiquidityPool addresses to register.
     *              Pass them in deployment order, e.g.:
     *              [ propUsdcPool, dceUsdcPool ]
     *
     * In Remix, enter as an address array:
     *   ["0xPROPusdcPool", "0xDCEusdcPool"]
     */
    constructor(address[] memory pools) {
        for (uint256 i = 0; i < pools.length; i++) {
            _registerPool(pools[i]);
        }
    }

    // ── Internal: Pool Registration ───────────────────────────────────────────

    function _registerPool(address pool) internal {
        if (pool == address(0)) revert ZeroAddress();
        address a = ILiquidityPool(pool).tokenA();
        address b = ILiquidityPool(pool).tokenB();
        getPool[a][b] = pool;
        getPool[b][a] = pool; // bidirectional
        emit PoolRegistered(pool, a, b);
    }

    // ── Modifier ──────────────────────────────────────────────────────────────

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    // ── Core Swap ─────────────────────────────────────────────────────────────

    /**
     * @notice Swap an exact amount of path[0] for as much path[last] as possible,
     *         routing through intermediate pools if the path has more than 2 tokens.
     *
     * @param amountIn      Exact amount of path[0] to spend.
     * @param amountOutMin  Minimum acceptable final output — reverts if not met.
     * @param path          Token address array:
     *                        2 elements → single-hop  (e.g. [PROP, mUSDC])
     *                        3 elements → two-hop     (e.g. [PROP, mUSDC, DCE])
     * @param to            Recipient of the final output token.
     * @param deadline      Unix timestamp — reverts if mined after this.
     * @return amountOut    Actual amount of path[last] received.
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        ensure(deadline)
        returns (uint256 amountOut)
    {
        if (amountIn == 0)        revert ZeroAmount();
        if (to == address(0))     revert ZeroAddress();
        if (path.length < 2)      revert InvalidPath();

        // Pull the first token from the caller into this router
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 currentAmount = amountIn;

        // ── Execute each hop sequentially ─────────────────────────────────────
        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn  = path[i];
            address tokenOut = path[i + 1];

            address pool = getPool[tokenIn][tokenOut];
            if (pool == address(0)) revert PoolNotFound(tokenIn, tokenOut);

            // Last hop → output goes directly to `to`; intermediate hops → router holds it
            address recipient = (i == path.length - 2) ? to : address(this);

            // Approve pool to pull tokenIn from router
            IERC20(tokenIn).forceApprove(pool, currentAmount);

            // Pool executes swap; returns actual amountOut for next hop
            // Pass minAmountOut = 0 here — we enforce our own check after all hops
            currentAmount = ILiquidityPool(pool).swap(currentAmount, 0, tokenIn, recipient);
        }

        amountOut = currentAmount;

        // ── Final slippage guard ───────────────────────────────────────────────
        if (amountOut < amountOutMin)
            revert InsufficientOutputAmount(amountOut, amountOutMin);

        emit SwapExecuted(msg.sender, path, amountIn, amountOut, to);
    }

    // ── Quote Helpers (read-only) ─────────────────────────────────────────────

    /**
     * @notice Returns the expected output amounts for each step in a swap path.
     *         Compatible with Uniswap V2's getAmountsOut interface.
     *
     * @param amountIn  Input amount for path[0].
     * @param path      Token address array (length ≥ 2).
     * @return amounts  Array of amounts for each token in the path.
     *                  amounts[0] = amountIn, amounts[last] = expected final output.
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        if (path.length < 2) revert InvalidPath();
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address pool = getPool[path[i]][path[i + 1]];
            if (pool == address(0)) revert PoolNotFound(path[i], path[i + 1]);

            (uint256 resA, uint256 resB,) = ILiquidityPool(pool).getReserves();
            bool isA = (ILiquidityPool(pool).tokenA() == path[i]);
            (uint256 resIn, uint256 resOut) = isA ? (resA, resB) : (resB, resA);

            amounts[i + 1] = ILiquidityPool(pool).getAmountOut(amounts[i], resIn, resOut);
        }
    }

    /**
     * @notice Returns the expected output for a single-hop swap.
     * @param amountIn  Input amount.
     * @param tokenIn   Input token address.
     * @param tokenOut  Output token address.
     */
    function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut)
        external
        view
        returns (uint256)
    {
        address pool = getPool[tokenIn][tokenOut];
        if (pool == address(0)) revert PoolNotFound(tokenIn, tokenOut);

        (uint256 resA, uint256 resB,) = ILiquidityPool(pool).getReserves();
        bool isA = (ILiquidityPool(pool).tokenA() == tokenIn);
        (uint256 resIn, uint256 resOut) = isA ? (resA, resB) : (resB, resA);

        return ILiquidityPool(pool).getAmountOut(amountIn, resIn, resOut);
    }

    /**
     * @notice Returns the reserves for the pool serving a given token pair.
     * @param tokenIn   One token of the pair.
     * @param tokenOut  The other token of the pair.
     */
    function getReserves(address tokenIn, address tokenOut)
        external
        view
        returns (uint256 reserveIn, uint256 reserveOut, uint256 lastBlockTimestamp)
    {
        address pool = getPool[tokenIn][tokenOut];
        if (pool == address(0)) revert PoolNotFound(tokenIn, tokenOut);

        (uint256 resA, uint256 resB, uint256 ts) = ILiquidityPool(pool).getReserves();
        bool isA = (ILiquidityPool(pool).tokenA() == tokenIn);
        (reserveIn, reserveOut) = isA ? (resA, resB) : (resB, resA);
        lastBlockTimestamp = ts;
    }
}
