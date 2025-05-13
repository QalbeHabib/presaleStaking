// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAggregator
 * @notice Mock Chainlink aggregator for ETH/USD price feed testing
 */
contract MockAggregator {
    int256 private _answer;
    uint256 private _timestamp;
    uint80 private _roundId;
    
    constructor() {
        _answer = 200000000000; // $2000 with 8 decimals by default
        _timestamp = block.timestamp;
        _roundId = 1;
    }
    
    /**
     * @dev Set the latest answer (price)
     * @param answer New price value (with 8 decimals)
     */
    function setLatestAnswer(int256 answer) external {
        _answer = answer;
        _timestamp = block.timestamp;
        _roundId++;
    }
    
    /**
     * @dev Get the latest round data
     * @return roundId Round ID
     * @return answer Price answer
     * @return startedAt Start timestamp
     * @return updatedAt Update timestamp
     * @return answeredInRound Round ID of the answer
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            _roundId,
            _answer,
            _timestamp,
            _timestamp,
            _roundId
        );
    }
} 