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

# Presale Staking Contract

A comprehensive Ethereum-based solution for conducting token presales with integrated staking mechanics, referral systems, and reward distribution.

## Overview

This project implements a configurable presale system with the following features:

- Multi-stage presale capabilities with price tiers
- Built-in staking mechanism with 200% APY
- Referral program with customizable rewards
- Token claiming system
- Comprehensive admin controls

## Contract Architecture

- **Sale.sol**: Main contract handling token presales and staking
- **StakingManager.sol**: Manages the staking mechanism
- **SaleBase.sol**: Base contract with shared functionality

### Token Allocation

- 30% for presale (30,000,000,000 tokens)
- 5% for referral rewards (5,000,000,000 tokens)
- 20% for staking rewards (20,000,000,000 tokens)

## Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- Git
- Hardhat development environment

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/presaleStaking.git
cd presaleStaking

# Install dependencies
npm install
```

## Deployment Guide

### 1. Start a Local Hardhat Node

```bash
npx hardhat node
```

This starts a local Ethereum network with 20 test accounts pre-funded with 10,000 ETH each.

### 2. Deploy the Contracts

In a new terminal window, run:

```bash
npx hardhat run scripts/combined-deploy-buyWithStake.js --network localhost
```

The script automatically:

1. Deploys test tokens (Sale Token and USDT)
2. Deploys a mock price oracle for ETH/USD conversion
3. Deploys the Sale contract with all dependencies
4. Pre-funds the contract with necessary token allocations
5. Creates and activates a presale
6. Tests various purchase and staking scenarios

### 3. Deployment Process Details

The deployment script executes the following steps:

1. **Deploy Test Sale Token**
   - 100 billion tokens with 18 decimals
   - Contract deployed at address shown in console

2. **Deploy Test USDT Token**
   - 10 million USDT with 6 decimals
   - Contract deployed at address shown in console

3. **Deploy Mock Oracle**
   - Simulates Chainlink price feed for ETH/USD
   - Contract deployed at address shown in console

4. **Deploy Sale Contract**
   - Configures with minimum purchase amount
   - Sets token allocations:
     - 30% for presale
     - 5% for referrals
     - 20% for staking
   - Contract deployed at address shown in console

5. **Configure Presale**
   - Price: 0.000001 USDT per token
   - Next stage price: 0.000002 USDT per token
   - Tokens to sell: 10,000,000
   - USDT hardcap: 100,000

## Testing Flow

The script automatically tests three distinct staking scenarios:

### Scenario 1: Direct Staking During Purchase
Buyer 1 purchases tokens with immediate staking:
- Purchases 50,000 USDT worth of tokens
- Tokens are automatically staked for 1 year
- 200% APY calculated and locked

### Scenario 2: Manual Staking After Purchase
Buyer 2 purchases tokens and stakes manually:
- Purchases 30,000 USDT worth of tokens
- Claims tokens after purchase
- Approves tokens for the staking contract
- Manually stakes tokens

### Scenario 3: Manual Claiming and Staking
Buyer 3 demonstrates the manual flow:
- Purchases 20,000 USDT worth of tokens
- Claims tokens
- Approves tokens for staking
- Manually stakes tokens

## Staking Mechanics

- **Lock Period**: 365 days
- **APY**: 200%
- **Staking Cap**: 6,666,666,667 tokens
- **Reward Calculation**: stakedAmount * APY / 100

## Contract Interaction

After deployment, you can interact with the contracts through:

1. **Hardhat Console**:
```bash
npx hardhat console --network localhost
```

2. **Custom Scripts**:
```bash
npx hardhat run scripts/your-script.js --network localhost
```

3. **Frontend Integration**:
   - Contract addresses are displayed in the console during deployment
   - Use these addresses to connect from a frontend application

## Customizing the Deployment

To modify the deployment parameters:

1. Edit `scripts/combined-deploy-buyWithStake.js`
2. Adjust token prices at line 89: `const nextStagePrice = ethers.utils.parseUnits("0.000002", 6);`
3. Change purchase amounts as needed

## Troubleshooting

### Common Issues

1. **Base constructor arguments given twice error**
   - Check inheritance chain and constructor parameter passing

2. **Insufficient allowance errors**
   - Ensure approval transactions are completed before purchases
   - Verify USDT approval amounts are sufficient

3. **Transaction failures**
   - Check transaction traces in Hardhat output
   - Verify token balances before operations

4. **Staking failures**
   - Ensure token approvals are completed
   - Check that staking is active and cap is not reached

## Example Transaction Flow

The deployment script generates transactions similar to:

1. USDT approval for Sale contract
2. ExcludeAccountFromMinBuy calls
3. buyWithUSDT transactions
4. enableClaim calls
5. claimAmount transactions
6. Token approvals for staking
7. stakeTokens calls

## License

MIT
