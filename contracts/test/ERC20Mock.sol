// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20Mock
 * @notice Mock ERC20 token for testing
 */
contract ERC20Mock is ERC20 {
    uint8 private _decimals;
    
    /**
     * @dev Constructor that creates mock token with specified decimals
     * @param name Token name
     * @param symbol Token symbol
     * @param decimalsValue Decimals for the token (e.g., 18 for most tokens, 6 for USDT)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalsValue
    ) ERC20(name, symbol) {
        _decimals = decimalsValue;
    }
    
    /**
     * @dev Override decimals function to return custom value
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to an address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
} 