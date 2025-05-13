// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Test Token
 * @notice Simple ERC20 token for testing purposes
 */
contract PresaleToken is ERC20, Ownable {
    uint8 private _decimals;

    /**
     * @dev Constructor that mints initial supply to the deployer
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply to mint
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = 18; // Default to 6 decimals
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Returns the number of decimals used for token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Allows owner to mint additional tokens if needed
     * @param to Address to receive the tokens
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setDecimals(uint8 newDecimals) external onlyOwner {
        _decimals = newDecimals;
    }
} 