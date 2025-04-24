// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Mock Chainlink Aggregator
 * @notice Mock implementation of Chainlink's price feed aggregator for local testing
 * @dev Returns a fixed price for ETH/USD
 */
contract MockAggregator is Ownable {
    // Using 8 decimals like Chainlink price feeds
    int256 private _price = 2000 * 10**8; // $2000 per ETH
    uint80 private _roundId = 1;
    uint256 private _timestamp;
    
    /**
     * @dev Constructor initializes with default values
     */
    constructor() Ownable(msg.sender) {
        _timestamp = block.timestamp;
    }
    
    /**
     * @dev Returns the latest round data (price, etc.)
     * @return roundId The round ID
     * @return answer The price (in this case, ETH/USD with 8 decimals)
     * @return startedAt Timestamp when the round started
     * @return updatedAt Timestamp of the last update
     * @return answeredInRound The round in which the answer was computed
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (_roundId, _price, _timestamp, _timestamp, _roundId);
    }
    
    /**
     * @dev Owner can update the price for testing different scenarios
     * @param newPrice The new price to set (with 8 decimals)
     */
    function setPrice(int256 newPrice) external onlyOwner {
        _price = newPrice;
        _roundId++;
        _timestamp = block.timestamp;
    }
} 