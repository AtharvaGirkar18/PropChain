// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal Chainlink Aggregator V3 interface needed by this consumer.
 * Kept local so the contract can be compiled in Remix without an extra import.
 */
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title PriceFeedConsumer
 * @notice Reads and validates the Chainlink ETH/USD feed for Experiment 7.
 * @dev Deploy with the address of the Chainlink feed proxy for the target chain.
 */
contract PriceFeedConsumer {
    IAggregatorV3 public immutable priceFeed;

    uint256 public constant MAX_PRICE_AGE = 1 days;

    error ZeroAddress();
    error InvalidFeedAddress();
    error InvalidPrice();
    error InvalidTimestamp();
    error IncompleteRound();
    error StalePrice(uint256 updatedAt);

    constructor(address feedAddress) {
        if (feedAddress == address(0)) revert ZeroAddress();
        if (feedAddress.code.length == 0) revert InvalidFeedAddress();
        priceFeed = IAggregatorV3(feedAddress);
    }

    /**
     * @notice Returns the latest positive ETH/USD answer and its metadata.
     * @return roundId Chainlink feed round identifier.
     * @return price Raw answer; scale it using feedDecimals (ETH/USD is commonly 8).
     * @return feedDecimals Number of decimals used by the feed answer.
     * @return updatedAt Timestamp of the latest completed feed update.
     */
    function getLatestPrice()
        external
        view
        returns (uint80 roundId, int256 price, uint8 feedDecimals, uint256 updatedAt)
    {
        uint80 answeredInRound;
        (roundId, price,, updatedAt, answeredInRound) = priceFeed.latestRoundData();

        if (price <= 0) revert InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp) revert InvalidTimestamp();
        if (answeredInRound < roundId) revert IncompleteRound();
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice(updatedAt);

        feedDecimals = priceFeed.decimals();
    }
}
