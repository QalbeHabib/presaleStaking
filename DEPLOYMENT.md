# Presale & Staking Contract Deployment Guide

This document provides instructions for deploying the Presale and Staking contracts to the Ethereum network.

## Contract Architecture

The system consists of the following components:

1. **SaleUtils** - Utility library with helper functions
2. **ISaleStructs** - Interface defining common data structures and events
3. **SaleBase** - Base contract with core presale functionality
4. **ReferralManager** - Manages referral relationships and rewards
5. **StakingManager** - Handles token staking functionality
6. **Sale** - Main contract that integrates all components

The inheritance hierarchy is as follows:

```
                          ┌───────────┐
                          │ SaleUtils │
                          └─────┬─────┘
                                │ uses
                                ▼
┌───────────────┐        ┌──────────────┐
│  ISaleStructs │◄───────┤   SaleBase   │
└───────────────┘        └──────┬───────┘
                                │ inherits
                                ▼
                         ┌──────────────┐
                         │ReferralManager│
                         └──────┬───────┘
                                │ inherits
                                ▼
                         ┌──────────────┐
                         │StakingManager │
                         └──────┬───────┘
                                │ inherits
                                ▼
                         ┌──────────────┐
                         │     Sale     │
                         └──────────────┘
```

## Prerequisites

- Node.js (v14+)
- Yarn or npm
- Hardhat
- Private key with ETH for deployment
- Access to a node endpoint (Infura, Alchemy, etc.)

## Environment Setup

1. Create a `.env` file with the following variables:

```
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

2. Install dependencies:

```bash
yarn install
```

## Deployment Process

The deployment follows these steps:

1. **Deploy SaleUtils Library** - This utility library is deployed first as it's used by other contracts.
2. **Deploy Sale Contract** - The main contract is deployed with references to the library and required parameters.
3. **Verify Contracts** - The contracts are verified on Etherscan for transparency.
4. **Fund the Contract** - Tokens are transferred to the contract for presale, referrals, and staking.

### Deployment to Sepolia Testnet

Run the following command to deploy to Sepolia testnet:

```bash
DEPLOY=sepolia yarn deploy:sepolia
```

### Deployment to Mainnet

For mainnet deployment:

```bash
DEPLOY=mainnet yarn deploy:mainnet
```

## Constructor Parameters

The Sale contract requires the following parameters:

1. **Oracle Address** - Chainlink ETH/USD price feed
2. **USDT Address** - The USDT token contract address
3. **Sale Token Address** - The token being sold in the presale
4. **Minimum Token to Buy** - Minimum purchase amount (in token units)
5. **Total Token Supply** - The total supply of the sale token

## Post-Deployment Steps

After successful deployment, complete these essential steps:

### 1. Transfer Tokens to the Contract

Transfer 55% of the total token supply to the Sale contract. This allocation is divided as:
- 30% for presale
- 5% for referral rewards
- 20% for staking rewards

```javascript
// Example code to transfer tokens
const tokenContract = await ethers.getContractAt("ERC20", tokenAddress);
const amount = totalSupply.mul(55).div(100); // 55% of total supply
await tokenContract.transfer(saleContractAddress, amount);
```

### 2. Pre-fund the Contract

Call the `preFundContract()` function to initialize the contract:

```javascript
const saleContract = await ethers.getContractAt("Sale", saleContractAddress);
await saleContract.preFundContract();
```

### 3. Create a Presale

Set up a presale with appropriate parameters:

```javascript
await saleContract.createPresale(
  tokenPrice,       // Price per token in USDT (scaled by decimals)
  nextStagePrice,   // Price for next stage
  tokensToSell,     // Tokens available in this presale
  usdtHardcap       // Maximum USDT to raise
);
```

### 4. Start the Presale

Activate the presale:

```javascript
await saleContract.startPresale();
```

## Contract Verification

The deployment script automatically attempts to verify the contracts on Etherscan. If verification fails, you can manually verify using:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

For the Sale contract which uses a library, use:

```bash
npx hardhat verify --network sepolia --libraries SaleUtils:<UTILS_ADDRESS> <SALE_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Managing the Presale

### Pausing/Unpausing the Presale

```javascript
// Pause
await saleContract.pausePresale(presaleId);

// Unpause
await saleContract.unPausePresale(presaleId);
```

### Enabling Claims

After the presale ends, enable token claiming:

```javascript
await saleContract.enableClaim(presaleId, true);
```

### Managing Staking

Toggle staking availability:

```javascript
await saleContract.setStakingStatus(true/false);
```

Update staking cap:

```javascript
await saleContract.updateStakingCap(newCap);
```

## Security Considerations

1. **Contract Pre-funding**: Ensure the contract has sufficient tokens before starting the presale.
2. **Oracle Updates**: The price feed oracle must be operational for ETH purchases.
3. **Access Control**: Only the owner can perform administrative functions.

## Troubleshooting

### Common Issues

1. **Deployment Gas Errors**: Increase the gas limit or check for network congestion.
2. **Verification Failures**: Ensure constructor arguments match exactly what was used during deployment.
3. **Pre-funding Failures**: Verify the token allowance and balances before attempting to pre-fund.

### Gas Optimization

The contracts have been split into multiple components to reduce deployment gas costs. If you encounter "out of gas" errors, try increasing the gas limit in your Hardhat config.

## Contact & Support

For issues, please open a ticket in the repository's issue tracker. 