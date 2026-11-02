// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** Minimal interfaces for the project's LiquidityPool and ERC20 tokens. */
interface IReferencePool {
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function getReserves() external view returns (uint256, uint256, uint256);
}

interface IReferenceToken {
    function decimals() external view returns (uint8);
}

/**
 * @title PoolPriceOracle
 * @notice Permissionless, checkpoint-based TWAP reference price for one AMM pair.
 * @dev Price is quote-token units per whole base token, scaled to 1e18.
 *      Anyone may call update() to record the pool spot price. It is not an
 *      automatic feed: updates should be recorded periodically, especially
 *      after trades, and a TWAP is unavailable until a full window is covered.
 */
contract PoolPriceOracle {
    uint256 public constant OBSERVATION_CAPACITY = 64;
    uint256 public immutable windowSeconds;
    IReferencePool public immutable pool;
    address public immutable baseToken;
    address public immutable quoteToken;
    uint8 public immutable baseDecimals;
    uint8 public immutable quoteDecimals;
    uint256 private immutable priceScaleExponent;

    struct Observation {
        uint64 timestamp;
        uint256 spotPriceE18;
        uint256 cumulativePrice;
    }

    Observation[64] private observations;
    uint256 public observationCount;
    uint256 public nextObservationIndex;
    uint256 public cumulativePrice;
    uint256 public lastUpdateTime;
    uint256 public lastSpotPriceE18;

    error ZeroAddress();
    error InvalidPoolPair();
    error InvalidWindow();
    error InvalidDecimals();
    error InsufficientLiquidity();
    error UpdateTooSoon();
    error TwapNotReady();

    event ObservationRecorded(uint256 timestamp, uint256 spotPriceE18, uint256 cumulativePrice);

    constructor(address poolAddress, address base, address quote, uint256 twapWindowSeconds) {
        if (poolAddress == address(0) || base == address(0) || quote == address(0)) revert ZeroAddress();
        if (base == quote) revert InvalidPoolPair();
        if (twapWindowSeconds == 0) revert InvalidWindow();

        IReferencePool candidate = IReferencePool(poolAddress);
        address a = candidate.tokenA();
        address b = candidate.tokenB();
        if (!((a == base && b == quote) || (a == quote && b == base))) revert InvalidPoolPair();

        uint8 baseDec = IReferenceToken(base).decimals();
        uint8 quoteDec = IReferenceToken(quote).decimals();
        // Keeps exponentiation bounded while supporting common ERC20 decimal ranges.
        if (baseDec + 18 < quoteDec || baseDec + 18 - quoteDec > 36) revert InvalidDecimals();

        pool = candidate;
        baseToken = base;
        quoteToken = quote;
        baseDecimals = baseDec;
        quoteDecimals = quoteDec;
        priceScaleExponent = baseDec + 18 - quoteDec;
        windowSeconds = twapWindowSeconds;
    }

    /** Record the current pool price and accrue the previous price over elapsed time. */
    function update() external {
        uint256 nowTime = block.timestamp;
        if (lastUpdateTime != 0 && nowTime == lastUpdateTime) revert UpdateTooSoon();

        uint256 spot = _currentSpotPriceE18();
        if (lastUpdateTime != 0) {
            cumulativePrice += lastSpotPriceE18 * (nowTime - lastUpdateTime);
        }

        observations[nextObservationIndex] = Observation({
            timestamp: uint64(nowTime),
            spotPriceE18: spot,
            cumulativePrice: cumulativePrice
        });
        nextObservationIndex = (nextObservationIndex + 1) % OBSERVATION_CAPACITY;
        if (observationCount < OBSERVATION_CAPACITY) observationCount++;

        lastSpotPriceE18 = spot;
        lastUpdateTime = nowTime;
        emit ObservationRecorded(nowTime, spot, cumulativePrice);
    }

    /** Return the time-weighted price over at least windowSeconds, scaled by 1e18. */
    function getTwapPrice() external view returns (uint256 priceE18, uint256 actualWindowSeconds, uint256 updatedAt) {
        if (lastUpdateTime == 0 || block.timestamp < windowSeconds) revert TwapNotReady();

        uint256 targetTime = block.timestamp - windowSeconds;
        bool found;
        uint256 startTime;
        uint256 startPrice;
        uint256 startCumulative;

        for (uint256 i = 0; i < observationCount; i++) {
            Observation memory obs = observations[i];
            if (obs.timestamp <= targetTime && (!found || obs.timestamp > startTime)) {
                found = true;
                startTime = obs.timestamp;
                startPrice = obs.spotPriceE18;
                startCumulative = obs.cumulativePrice;
            }
        }
        if (!found) revert TwapNotReady();

        uint256 cumulativeAtTarget = startCumulative + startPrice * (targetTime - startTime);
        uint256 cumulativeNow = cumulativePrice + lastSpotPriceE18 * (block.timestamp - lastUpdateTime);
        actualWindowSeconds = block.timestamp - targetTime;
        priceE18 = (cumulativeNow - cumulativeAtTarget) / actualWindowSeconds;
        updatedAt = lastUpdateTime;
    }

    /** Current spot price, quote-token units per whole base token, scaled by 1e18. */
    function getSpotPrice() external view returns (uint256) {
        return _currentSpotPriceE18();
    }

    function _currentSpotPriceE18() private view returns (uint256) {
        (uint256 reserveA, uint256 reserveB,) = pool.getReserves();
        uint256 reserveBase;
        uint256 reserveQuote;
        if (pool.tokenA() == baseToken) {
            reserveBase = reserveA;
            reserveQuote = reserveB;
        } else {
            reserveBase = reserveB;
            reserveQuote = reserveA;
        }
        if (reserveBase == 0 || reserveQuote == 0) revert InsufficientLiquidity();
        return (reserveQuote * (10 ** priceScaleExponent)) / reserveBase;
    }
}
