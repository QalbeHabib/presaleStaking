# Presale Staking System Documentation

## Overview

The presale contract includes a high-yield staking system that allows token holders to lock their tokens for a fixed period in exchange for rewards. This document outlines the implementation details, rules, and available functions for frontend integration.

## Key Features

1. **High APY Rewards**

   - Fixed 200% APY reward rate for all stakers
   - Rewards are calculated based on the staked amount
   - Example: If a user stakes 1,000 tokens, they'll receive 2,000 tokens as rewards after the lock period

2. **One-Year Lock Period**

   - All stakes are locked for a fixed period of 365 days
   - During the lock period, tokens cannot be withdrawn
   - The unlock timestamp is stored and verified for each stake

3. **Auto-Staking Option During Purchase**

   - Users can choose to stake tokens directly during purchase
   - Option available in both ETH and USDT purchase methods
   - Eliminates the need for separate approval and staking transactions

4. **Staking Limits and Safety**

   - Staking is capped at 6,666,666,667 tokens
   - Total rewards are limited to 20% of the token supply
   - Staking automatically deactivates when the cap is reached

## How Staking Works

### Staking Process

1. **Initiating a Stake**

   - Users can stake tokens by calling `stakeTokens(uint256 _amount)` directly
   - Alternatively, they can set `shouldStake = true` when buying tokens
   - The system will validate the staking cap and reward limits

2. **Lock Period**

   - Once staked, tokens are locked for 365 days
   - The unlock time is calculated as: `block.timestamp + 365 days`
   - The lock status can be checked using `getUserStakingInfo()`

3. **Reward Calculation**

   - Rewards are calculated as: `stakedAmount * STAKING_APY / 100`
   - With the 200% APY, a user receives double their staked amount as rewards
   - Total claimable amount is: `stakedAmount + reward`

4. **Withdrawing Stakes**

   - After the lock period ends, users can withdraw using `withdrawStake()`
   - The function transfers both the original stake and earned rewards
   - The stake is marked as withdrawn to prevent double-withdrawals

## Technical Implementation

### Data Structures

```solidity
// Staking information structure
struct StakeInfo {
    uint256 stakedAmount;         // Amount of tokens staked
    uint256 stakingTimestamp;     // When the stake was created
    uint256 unlockTimestamp;      // When the stake can be withdrawn
    bool hasWithdrawn;            // Whether the stake has been withdrawn
}

// Staking system variables
uint256 public constant STAKING_APY = 200;          // 200% APY
uint256 public totalStaked;                         // Total tokens staked
uint256 public stakingCap;                          // Maximum tokens that can be staked
bool public stakingActive;                          // Whether staking is active
uint256 public totalStakingRewardsIssued;           // Total rewards committed

// Staking system mappings
mapping(address => StakeInfo) public userStakes;    // User stake information
mapping(address => bool) public userStakingIntent;  // Tracks users who want to stake upon claim
```

### Core Functions

1. **Staking Tokens**

   - The `stakeTokens(uint256 _amount)` function handles direct staking
   - The `_handleTokenStaking(address _user, uint256 _amount)` function is used internally for purchase-time staking
   - Both update global state variables and create new stake records

2. **Processing Stakes**

   - The `_createNewStake()` function initializes a new stake record
   - For existing stakes that are unlocked, `_processUnlockedStake()` is called first
   - These functions manage the transition between stake periods

3. **Withdrawing Stakes**
   - The `withdrawStake()` function allows users to claim their stake and rewards
   - Implements reentrancy protection with the `nonReentrant` modifier
   - Verifies stake existence, lock period, and that it hasn't been withdrawn before

## Frontend Integration

### Methods for Frontend Use

1. **Check User Staking Information**

   ```solidity
   function getUserStakingInfo(address _user) external view returns (
       uint256 stakedAmount,
       uint256 stakingTime,
       uint256 unlockTime,
       bool isLocked,
       bool hasWithdrawn,
       uint256 potentialReward,
       uint256 totalClaimable
   )
   ```

   - Returns comprehensive staking information for a user
   - Shows current lock status, potential rewards, and total claimable amount
   - Used to display staking status on user dashboard

2. **Get Staking Program Statistics**

   ```solidity
   function getStakingStats() external view returns (
       uint256 _totalStaked,
       uint256 _stakingCap,
       uint256 _stakingAPY,
       bool _isActive,
       uint256 _maxRewards,
       uint256 _totalRewardsCommitted,
       uint256 _remainingRewards
   )
   ```

   - Returns global statistics for the staking program
   - Useful for displaying program status on the website

3. **Check Staking Availability**

   ```solidity
   function getStakingAvailability() external view returns (
       bool _canStake,
       uint256 _remainingCapacity,
       uint256 _percentFilled
   )
   ```

   - Provides quick information about staking availability
   - Shows remaining capacity and percentage of cap already filled
   - Useful for UI indicators and progress bars

4. **Set Staking Intent for Claims**
   ```solidity
   function setStakingIntent(bool _intent) external
   ```
   - Allows users to set their preference for staking tokens upon claim
   - When true, claimed tokens will automatically be staked
   - Useful for users who want to stake their purchased tokens later

## Using Staking When Purchasing Tokens

To automatically stake tokens during purchase, users can:

1. Call `buyWithUSDT(uint256 usdAmount, address referrer, bool shouldStake)` with `shouldStake = true`
2. Call `buyWithEth(address referrer, bool shouldStake)` with `shouldStake = true`

The contract will automatically:

1. Process the token purchase
2. Create a staking position with the purchased tokens
3. Set the appropriate lock period
4. Update all relevant staking statistics

## Error Handling and Custom Errors

The staking system uses custom errors for more efficient error reporting:

```solidity
error StakingInactive();       // Thrown when staking is not active
error ZeroAmount();            // Thrown when trying to stake zero tokens
error CapExceeded();           // Thrown when staking would exceed the cap
error RewardLimitExceeded();   // Thrown when rewards would exceed limits
error LockedStakeExists();     // Thrown when trying to stake with locked stake
error TransferFailed();        // Thrown when a token transfer fails
```

## Security Considerations

1. **Reentrancy Protection**

   - All state-changing functions use the `nonReentrant` modifier
   - State changes are made before external calls to prevent reentrancy attacks

2. **Withdrawal Verification**

   - Staking withdrawals verify the stake exists and is unlocked
   - The `hasWithdrawn` flag prevents double-withdrawal
   - The contract verifies it has sufficient tokens before transfers

3. **Cap Enforcement**

   - The system enforces the staking cap to limit overall staking
   - Automatically disables staking when the cap is reached
   - Prevents excessive token lock-up

4. **Safe Token Handling**

   - Transfers use safe methods with error checking
   - The system verifies token receipts to protect against fee-on-transfer tokens
   - Withdrawal functions verify contract balances before processing

5. **Admin Withdrawal Protection**
   - Staked tokens are protected from admin withdrawals
   - The `WithdrawAllTokens` function calculates and reserves staked tokens:
     ```solidity
     // Reserved for active stakes plus their potential rewards
     uint256 stakingReserved = totalStaked * (STAKING_APY + 100) / 100;
     // Only allow withdrawal of: contractBalance - reservedTokens
     ```
   - This calculation includes both the principal (staked tokens) and all future rewards
   - Even though tokens physically remain in the contract, the code logic prevents admins from accessing funds that belong to stakers
   - This protection remains in place for the entire duration of the stake
   - Admins can only withdraw truly excess tokens that aren't allocated to any user

## Example Staking Flow

1. User purchases 100,000 tokens (worth 1,000 USDT) with `shouldStake = true`

   - System creates a stake record with 100,000 tokens
   - Lock period is set for 365 days from purchase
   - Potential reward is calculated as 200,000 tokens (200% of staked amount)
   - Total claimable after lock period: 300,000 tokens

2. After 365 days, user calls `withdrawStake()`

   - System verifies the lock period has passed
   - User receives 300,000 tokens (100,000 staked + 200,000 rewards)
   - Stake is marked as withdrawn to prevent double-claiming

3. User makes another purchase and stakes again
   - New stake record is created with a new lock period
   - Process repeats for the new stake

## Conclusion

The staking system provides a secure and high-yield option for users to earn rewards on their tokens during the presale. The implementation includes proper time locking, reward calculation, and security measures to ensure a smooth staking experience. The provided frontend integration methods make it easy to incorporate the staking system into the website or dApp interface.
