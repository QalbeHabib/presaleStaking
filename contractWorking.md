# Presale, Referral, and Staking Smart Contract

This document explains the functionality and operation of our integrated token presale platform that combines presale, referral, and staking mechanisms.

## Table of Contents

1. [Overview](#overview)
2. [Contract Architecture](#contract-architecture)
3. [Presale System](#presale-system)
4. [Referral System](#referral-system)
5. [Staking System](#staking-system)
6. [System Interactions](#system-interactions)
7. [Deployment and Setup](#deployment-and-setup)
8. [User Workflows](#user-workflows)
9. [Security Features](#security-features)
10. [Technical Reference](#technical-reference)
11. [Function Use Cases](#function-use-cases)

## Overview

This smart contract platform allows users to:

- Participate in token presales
- Earn rewards by referring others
- Stake tokens for high APY returns
- Combine these functions for maximum benefits

## Contract Architecture

The system is built using three integrated contracts:

```
Sale (main contract)
  ├── SaleBase (presale & referral functionality)
  └── StakingManager (staking functionality)
```

**Token Allocation:**

- 30% for presale (30,000,000,000 tokens)
- 5% for referral rewards (5,000,000,000 tokens)
- 20% for staking rewards (20,000,000,000 tokens)
- **Total:** 55% of token supply is managed by the contract

## Presale System

### How the Presale Works

1. **Initialization**

   - Owner deploys contract with token address, oracle for ETH price feed, and other parameters
   - Owner transfers 55% of token supply to the contract
   - Owner calls `preFundContract()` to activate the presale system

2. **Presale Creation**

   - Owner creates a presale with `createPresale()` specifying:
     - `_price`: Token price in USD
     - `_nextStagePrice`: Price for next stage
     - `_tokensToSell`: Number of tokens for sale
     - `_UsdtHardcap`: Maximum USDT to raise

3. **Presale Management**

   - `startPresale()`: Activates current presale
   - `endPresale()`: Ends active presale
   - `enableClaim()`: Enables token claiming for a specific presale
   - `pausePresale()` / `unPausePresale()`: Emergency controls

4. **Token Purchase Methods**

   - `buyWithEth()`: Purchase with ETH
   - `buyWithUSDT()`: Purchase with USDT
   - Both accept optional referrer and staking preference

5. **Token Claiming**
   - `claimAmount()`: Claim tokens from a specific presale
   - `claimMultiple()`: Claim from multiple presales at once

## Referral System

### How Referrals Work

1. **Qualification**

   - Users must purchase at least **1,000 tokens** to qualify as referrers
   - Qualification tracked through `hasQualifiedPurchase` mapping

2. **Referral Process**

   - During purchase, buyer can specify a referrer address
   - System verifies referrer is qualified and not the same as buyer
   - Referral relationship stored permanently

3. **Reward Structure**

   - **Default reward:** 20% of purchase amount (configurable)
   - **Both parties rewarded:** Referrer and referee each get equal rewards
   - **Example:** 1,000 token purchase → 200 tokens reward for each person

4. **Reward Claiming**

   - `claimReferralRewards()`: Withdraw accumulated referral rewards
   - System verifies sufficient token balance before transfer

5. **Limits and Protection**
   - 5% of total supply allocated for referral rewards
   - Time-lock of 24 hours for referral percentage changes
   - Protection against self-referrals and multiple referrer changes

## Staking System

### How Staking Works

1. **Staking Parameters**

   - **Lock period:** 365 days (1 year)
   - **APY:** 200%
   - **Staking cap:** 6,666,666,667 tokens

2. **Staking Methods**

   - **During purchase:** Set `shouldStake = true` when buying tokens
   - **Manual staking:** Call `stakeTokens()` with desired amount
   - **During claim:** Set staking intent before claiming tokens

3. **Staking Records**

   - Each stake tracked with:
     - `stakedAmount`: Amount of tokens staked
     - `stakingTimestamp`: When stake was created
     - `unlockTimestamp`: When tokens can be withdrawn
     - `hasWithdrawn`: Flag to prevent double withdrawals

4. **Reward Calculation**

   - Rewards = stakedAmount × 200% (2× the staked amount)
   - Example: 1,000 tokens staked → 2,000 tokens reward

5. **Withdrawing Stakes**
   - After lock period (1 year), call `withdrawStake()`
   - Receive original stake + rewards
   - Example: 1,000 tokens staked → 3,000 tokens withdrawn (original + reward)

## System Interactions

### Combined Features

1. **Purchase with Immediate Staking**

   ```
   buyWithEth(referrer, true) or buyWithUSDT(amount, referrer, true)
   ```

   - Tokens are purchased and automatically staked
   - No need to claim tokens first

2. **Referral + Staking Combo**

   - Users can be referred AND choose to stake
   - This maximizes their rewards:
     - Referral reward (20% of purchase)
     - Staking reward (200% after 1 year)

3. **Reward Calculation Example**

   - User buys 1,000 tokens with referrer and stakes:
     - Initial purchase: 1,000 tokens
     - Referral reward: 200 tokens (20%)
     - Staking reward: 2,000 tokens (200% after 1 year)
     - Total after 1 year: 3,200 tokens (320% of initial purchase)

4. **Stats and Information**
   - `getUserReferralInfo()`: Check referral status and rewards
   - `getUserStakingInfo()`: View staking details and potential rewards
   - `getStakingStats()`: View global staking information
   - `getReferralProgramStats()`: View referral program details

## Deployment and Setup

1. **Deployment**

   - Deploy using script in `deploy/sepolia.ts`
   - Requires parameters:
     - Oracle address (Chainlink ETH/USD price feed)
     - USDT token address
     - Your ERC20 token address
     - Minimum tokens to buy
     - Total token supply

2. **Post-Deployment Setup**
   - Transfer 55% of token supply to contract address
   - Call `preFundContract()` to verify and activate
   - Create presale with `createPresale()`
   - Start presale with `startPresale()`

## User Workflows

### For Buyers

1. **Simple Purchase**

   - Buy with ETH/USDT without referrer or staking
   - Claim tokens after presale ends and claims enabled

2. **Purchase with Referral**

   - Buy with ETH/USDT specifying a referrer address
   - Both buyer and referrer earn 20% rewards
   - Claim tokens after presale

3. **Purchase with Staking**

   - Buy with ETH/USDT with `shouldStake = true`
   - Tokens automatically staked for 1 year
   - Withdraw original + 200% after lock period

4. **Maximum Benefit**
   - Buy with referrer AND immediate staking
   - Earn referral rewards AND staking rewards
   - Potential 320% return after 1 year

### For Referrers

1. **Qualify as Referrer**

   - Purchase at least 1,000 tokens
   - Status automatically updated in contract

2. **Share Referral Link**

   - Generate link with your address as referrer
   - When others purchase through link, both earn rewards

3. **Claim Rewards**
   - Call `claimReferralRewards()` to withdraw earned rewards
   - No lock period for referral rewards

## Security Features

1. **Anti-Gaming Protections**

   - Prevention of self-referrals
   - One referrer per user
   - Timelock on referral percentage changes

2. **Funds Safety**

   - Separation of presale, referral, and staking pools
   - Reserve calculations before withdrawals
   - Checks for balance adequacy before transfers

3. **Contract Controls**
   - Pausable presales for emergency situations
   - Ownership controls for sensitive functions
   - Cap management for staking and referrals

---

## Technical Reference

### Key Constants

- `STAKING_LOCK_PERIOD`: 365 days
- `STAKING_APY`: 200%
- `MINIMUM_PURCHASE_FOR_REFERRAL`: 1,000 tokens
- `REFERRAL_REWARD_PERCENTAGE`: 20% (default, configurable)
- `PRESALE_ALLOCATION_PERCENT`: 30%
- `REFERRAL_ALLOCATION_PERCENT`: 5%
- `STAKING_ALLOCATION_PERCENT`: 20%

### Key Functions

**Presale:**

- `createPresale(price, nextStagePrice, tokensToSell, UsdtHardcap)`
- `startPresale()`
- `endPresale()`
- `buyWithEth(referrer, shouldStake)`
- `buyWithUSDT(amount, referrer, shouldStake)`
- `claimAmount(presaleId)`

**Referral:**

- `recordReferral(referrer)`
- `processReferralRewards(user, amount)`
- `claimReferralRewards()`
- `getUserReferralInfo(user)`

**Staking:**

- `stakeTokens(amount)`
- `withdrawStake()`
- `getUserStakingInfo(user)`
- `getStakingStats()`

**Admin Functions:**

- `preFundContract()`
- `updateStakingCap(newCap)`
- `setStakingStatus(status)`
- `updateReferralRewardPercentage(percentage)`
- `safeWithdraw(token, amount, recipient)`

## Function Use Cases

### Detailed Function Breakdown

#### Presale Functions

1. **`createPresale(uint256 _price, uint256 _nextStagePrice, uint256 _tokensToSell, uint256 _UsdtHardcap)`**

   - **Access:** Owner only
   - **Description:** Creates a new presale with specified parameters
   - **Parameters:**
     - `_price`: Token price in USD (with decimals)
     - `_nextStagePrice`: Price for next stage of presale
     - `_tokensToSell`: Total number of tokens available in this presale
     - `_UsdtHardcap`: Maximum amount of USDT to raise
   - **Use Case:** Before launching presale, owner sets up the parameters
   - **Example:**
     ```solidity
     // Set price at $0.01, next stage $0.02, sell 10 million tokens with $100k hardcap
     createPresale(10000000, 20000000, 10000000 * 10**18, 100000 * 10**6)
     ```

2. **`startPresale()`**

   - **Access:** Owner only
   - **Description:** Activates the current presale
   - **Use Case:** Once parameters are set and tokens funded, start accepting purchases
   - **Example:**
     ```solidity
     // After creating presale and funding contract
     startPresale()
     ```

3. **`endPresale()`**

   - **Access:** Owner only
   - **Description:** Ends the current presale
   - **Use Case:** When hardcap reached or end time arrives
   - **Example:**
     ```solidity
     // After presale period completes
     endPresale()
     ```

4. **`buyWithEth(address referrer, bool shouldStake)`**

   - **Access:** Public
   - **Description:** Purchase tokens using ETH
   - **Parameters:**
     - `referrer`: Address of referrer (optional, use address(0) for none)
     - `shouldStake`: Whether to stake tokens immediately
   - **Use Case:** Users purchase tokens with ETH from their wallet
   - **Example:**
     ```solidity
     // Buy tokens with 1 ETH, with referrer, and stake immediately
     buyWithEth(0x123...abc, true){value: 1 ether}
     ```

5. **`buyWithUSDT(uint256 usdAmount, address referrer, bool shouldStake)`**

   - **Access:** Public
   - **Description:** Purchase tokens using USDT
   - **Parameters:**
     - `usdAmount`: Amount of USDT to spend
     - `referrer`: Address of referrer (optional)
     - `shouldStake`: Whether to stake tokens immediately
   - **Use Case:** Users purchase tokens with USDT from their wallet
   - **Example:**
     ```solidity
     // Buy tokens with 100 USDT, no referrer, don't stake
     buyWithUSDT(100 * 10**6, address(0), false)
     ```

6. **`claimAmount(uint256 _id)`**
   - **Access:** Public
   - **Description:** Claim tokens from a specific presale ID
   - **Parameters:**
     - `_id`: Presale ID to claim from
   - **Use Case:** After presale ends and claiming is enabled, users get their tokens
   - **Example:**
     ```solidity
     // Claim tokens from presale ID 1
     claimAmount(1)
     ```

#### Referral Functions

1. **`recordReferral(address _referrer)`**

   - **Access:** Internal
   - **Description:** Records a valid referral relationship
   - **Parameters:**
     - `_referrer`: Address of the referrer
   - **Use Case:** Called internally during purchase to register referrer
   - **Example:** Automatically called during `buyWithEth` or `buyWithUSDT`

2. **`processReferralRewards(address _user, uint256 _tokenAmount)`**

   - **Access:** Internal
   - **Description:** Calculates and assigns referral rewards
   - **Parameters:**
     - `_user`: User who made the purchase
     - `_tokenAmount`: Amount of tokens purchased
   - **Use Case:** Automatically processed during token purchase
   - **Example:** Internally processes 20% reward for both parties

3. **`claimReferralRewards()`**

   - **Access:** Public
   - **Description:** Withdraw accumulated referral rewards
   - **Use Case:** Referrers claim their accumulated rewards
   - **Example:**
     ```solidity
     // Claim all available referral rewards
     claimReferralRewards()
     ```

4. **`getUserReferralInfo(address _user)`**
   - **Access:** External view
   - **Description:** Get detailed referral status and rewards
   - **Parameters:**
     - `_user`: Address to check
   - **Use Case:** Check referral status, available rewards, and statistics
   - **Example:**
     ```solidity
     // Get Alice's referral status
     getUserReferralInfo(aliceAddress)
     // Returns: referrer, totalRewards, claimedRewards, pendingRewards, etc.
     ```

#### Staking Functions

1. **`stakeTokens(uint256 _amount)`**

   - **Access:** External
   - **Description:** Manually stake tokens
   - **Parameters:**
     - `_amount`: Amount of tokens to stake
   - **Use Case:** Users stake tokens they already own
   - **Example:**
     ```solidity
     // Stake 1,000 tokens
     stakeTokens(1000 * 10**18)
     ```

2. **`_handleTokenStaking(address _user, uint256 _amount)`**

   - **Access:** Internal
   - **Description:** Core staking logic used by all staking methods
   - **Parameters:**
     - `_user`: User who is staking
     - `_amount`: Amount to stake
   - **Use Case:** Called internally during purchase or claim with staking
   - **Example:** Automatically manages stake record creation

3. **`withdrawStake()`**

   - **Access:** External
   - **Description:** Withdraw staked tokens and rewards after lock period
   - **Use Case:** Claim original stake plus 200% rewards after 1 year
   - **Example:**
     ```solidity
     // After 365 days, withdraw stake and rewards
     withdrawStake()
     ```

4. **`getUserStakingInfo(address _user)`**
   - **Access:** External view
   - **Description:** Get detailed staking information
   - **Parameters:**
     - `_user`: Address to check
   - **Use Case:** Check staking status, lock time, and potential rewards
   - **Example:**
     ```solidity
     // Check Bob's staking status
     getUserStakingInfo(bobAddress)
     // Returns: stakedAmount, stakingTime, unlockTime, isLocked, etc.
     ```

#### Admin Functions

1. **`preFundContract()`**

   - **Access:** Owner only
   - **Description:** Activates the contract after token funding
   - **Use Case:** After transferring tokens to contract, verify and activate
   - **Example:**
     ```solidity
     // After transferring 55% of total supply to contract
     preFundContract()
     ```

2. **`updateStakingCap(uint256 _newCap)`**

   - **Access:** Owner only
   - **Description:** Modify the maximum tokens that can be staked
   - **Parameters:**
     - `_newCap`: New staking cap
   - **Use Case:** Adjust staking capacity based on market conditions
   - **Example:**
     ```solidity
     // Increase staking cap to 10 billion tokens
     updateStakingCap(10000000000 * 10**18)
     ```

3. **`setStakingStatus(bool _status)`**

   - **Access:** Owner only
   - **Description:** Enable or disable staking functionality
   - **Parameters:**
     - `_status`: New staking status (true/false)
   - **Use Case:** Emergency control or scheduled maintenance
   - **Example:**
     ```solidity
     // Temporarily disable staking
     setStakingStatus(false)
     ```

4. **`updateReferralRewardPercentage(uint256 _percentage)`**

   - **Access:** Owner only
   - **Description:** Change referral reward percentage
   - **Parameters:**
     - `_percentage`: New percentage (1-20)
   - **Use Case:** Adjust referral incentives based on program performance
   - **Example:**
     ```solidity
     // Increase referral rewards to 15%
     updateReferralRewardPercentage(15)
     ```

5. **`safeWithdraw(address _token, uint256 _amount, address _recipient)`**
   - **Access:** Owner only
   - **Description:** Withdraw tokens not needed for staking or referrals
   - **Parameters:**
     - `_token`: Token address to withdraw
     - `_amount`: Amount to withdraw
     - `_recipient`: Recipient address
   - **Use Case:** Recover excess tokens while preserving user funds
   - **Example:**
     ```solidity
     // Withdraw 1 million excess tokens to treasury
     safeWithdraw(tokenAddress, 1000000 * 10**18, treasuryAddress)
     ```

### Advanced Use Cases

1. **Multi-Stage Presale**

   - Create first presale with initial price
   - When first presale ends, create second with higher price
   - Example:
     ```solidity
     // Stage 1: $0.01 per token
     createPresale(10000000, 20000000, 5000000 * 10**18, 50000 * 10**6)
     startPresale()
     // Later, after endPresale()
     // Stage 2: $0.02 per token
     createPresale(20000000, 30000000, 5000000 * 10**18, 100000 * 10**6)
     startPresale()
     ```

2. **Emergency Pause and Recovery**

   - If suspicious activity detected, pause presale
   - Example:
     ```solidity
     // Pause presale ID 1
     pausePresale(1)
     // After investigation
     unPausePresale(1)
     ```

3. **Customized Referral Campaign**

   - Increase referral rewards for special event
   - Example:
     ```solidity
     // Increase referral rewards to 15% for limited time
     updateReferralRewardPercentage(15)
     // Later, return to normal
     updateReferralRewardPercentage(20)
     ```

4. **Programmatic Interaction via Front-End**

   - Check if user can refer others
   - Example JavaScript/Web3:

     ```javascript
     // Check if user can refer others
     const canRefer = await contract.canReferOthers(userAddress);

     // Generate referral link if qualified
     if (canRefer) {
       const referralLink = `https://our-presale.com?ref=${userAddress}`;
       displayReferralLink(referralLink);
     }
     ```

5. **Staking Performance Dashboard**
   - Monitor global staking statistics
   - Example JavaScript/Web3:

     ```javascript
     // Get staking program stats
     const stats = await contract.getStakingStats();

     // Display stats in dashboard
     displayStats({
       totalStaked: formatTokens(stats._totalStaked),
       stakingCap: formatTokens(stats._stakingCap),
       percentageFilled: (stats._totalStaked * 100) / stats._stakingCap,
       APY: stats._stakingAPY + '%',
       remainingRewards: formatTokens(stats._remainingRewards),
     });
     ```
