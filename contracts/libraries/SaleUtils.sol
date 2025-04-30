// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Sale Utilities Library
 * @notice Utility functions used across the presale system
 */
library SaleUtils {
    /**
     * @dev Helper to check if an address is a contract
     * @param _addr Address to check
     * @return True if the address is a contract
     */
    function isContract(address _addr) internal view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    /**
     * @dev Helper function to send ETH safely
     * @param recipient Address to send ETH to
     * @param amount Amount of ETH to send
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Low balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH Payment failed");
    }
} 