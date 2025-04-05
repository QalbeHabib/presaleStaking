# PoolTogether V4 Testnet

The V4 testnet deployed contracts and essential hardhat tasks.

# Getting Started

Install `direnv` module.

We use [direnv](https://direnv.net/) to manage environment variables. You'll likely need to install it.

```sh
cp .envrc.example .envrc
```

# Presale and Staking Contract

This repository contains a Solidity smart contract for token presales, referrals, and staking functionality.

## Contract Size Optimization

The original contract exceeded the 24KB bytecode limit introduced in the Spurious Dragon Ethereum hard fork. To address this issue, we've implemented the following optimizations:

### 1. Contract Splitting

The original monolithic contract has been split into three specialized contracts:

- **SaleBase.sol**: Handles the core functionality for presales and referrals
- **StakingManager.sol**: Manages token staking logic
- **Sale.sol**: The main contract that inherits from both base contracts

This approach significantly reduces the bytecode size of each contract while maintaining all functionality.

### 2. Code Organization

- Common constants and utility functions are placed in the appropriate base contract
- Inheritance is used to access functionality from both parent contracts
- Each contract has a clearly defined responsibility

### 3. Additional Optimizations

- Removed redundant code and simplified complex logic
- Consolidated related functionality
- Used descriptive constants instead of magic numbers
- Improved error handling with clear messages

## Contract Structure

```
Sale (main contract)
  ├── SaleBase (presale & referral functionality)
  └── StakingManager (staking functionality)
```

## Deployment Instructions

1. Deploy the main Sale contract, which automatically deploys the base contracts through inheritance
2. The constructor requires the following parameters:
   - `_oracle`: Chainlink oracle for ETH price feed
   - `_usdt`: USDT token address
   - `_SaleToken`: Sale token address
   - `_MinTokenTobuy`: Minimum tokens that can be purchased
   - `_totalTokenSupply`: Total token supply (100,000,000,000)

## Token Allocation

The contract is designed to handle the following token allocation:

- 30% for presale (30,000,000,000 tokens)
- 5% for referral rewards (5,000,000,000 tokens)
- 20% for staking rewards (20,000,000,000 tokens)

Total: 55% of total supply must be transferred to this contract before activating the presale.

## Post-Deployment Setup

1. Transfer 55% of token supply to the contract address
2. Call `preFundContract()` function to verify and activate the pre-funding
3. Create a presale using `createPresale()` function
4. Start the presale with `startPresale()`

## User Flows

### Buying Tokens

- Users can buy tokens using ETH or USDT through `buyWithEth()` or `buyWithUSDT()`
- Both functions accept a `shouldStake` parameter to indicate immediate staking intention

### Staking Tokens

- If a user chooses to stake during purchase, all tokens are marked for staking
- When claiming tokens, they are automatically staked if the user indicated staking intent
- Users can also stake tokens manually through the `stakeTokens()` function

### Claiming Tokens

- Users claim tokens with the `claimAmount()` function
- The function automatically handles staking if the user previously indicated intent

## Security Features

- ReentrancyGuard to prevent reentrancy attacks
- Proper balance checks before token transfers
- Time-locked parameters for sensitive settings
- Ownership controls for administrative functions
- Safeguards to prevent withdrawal of tokens needed for rewards

## Optimization Results

By splitting the contract, we've reduced the bytecode size significantly while maintaining all functionality, allowing the contract to be deployed on the Ethereum mainnet.
