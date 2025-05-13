# Presale Referral System Documentation

## Overview

The presale contract includes a comprehensive referral system that rewards both referrers and referees. This document outlines the implementation details, rules, and available functions for frontend integration.

## Key Features

1. **Single Referrer Policy**

   - Each user can only have one referrer throughout the presale
   - Once a referral relationship is established, it cannot be changed
   - The `hasUsedReferral` mapping enforces this by tracking if a user has already been referred

2. **Anti-Circular Referral Protection**

   - All forms of circular referrals are strictly prohibited and actively prevented
   - Direct circular referrals (A refers B, B cannot refer A) are blocked
   - Multi-level circular referrals (A refers B, B refers C, C cannot refer A) are also blocked
   - The contract traverses the entire referral chain to ensure no circular relationships exist

3. **Referral Rewards**

   - Both referrer and referee receive equal rewards
   - Default reward rate is 20% (configurable by owner with a maximum of 20%)
   - Rewards are calculated as a percentage of the token amount purchased
   - Example: If a user buys 1,000 tokens with a 20% reward rate, both the referrer and referee receive 200 tokens each
   - Total referral rewards limited to 5% of total token supply

4. **Referrer Qualification**
   - Users must purchase at least 1,000 tokens to qualify as referrers
   - The `hasQualifiedPurchase` mapping tracks qualified referrers
   - Attempting to use an unqualified referrer will result in a transaction reverting
   - This minimum purchase requirement prevents spam and gaming of the system

## Who Can Refer Others

To qualify as a referrer, a user must:

1. Have purchased at least 1,000 tokens (MINIMUM_PURCHASE_FOR_REFERRAL)

   - This minimum purchase requirement applies to the total tokens purchased in a single transaction
   - A user automatically qualifies as a referrer once they meet this requirement, even if they didn't use a referrer code themselves
   - Multiple smaller purchases cannot be combined to meet this minimum requirement

2. Have a valid wallet address (not a contract address)

   - Contract addresses are explicitly prohibited from acting as referrers to prevent potential exploits
   - This is verified using a check that determines if an address contains code

3. Not be involved in a circular referral chain
   - A user cannot refer someone who has directly or indirectly referred them
   - The contract traverses the entire referral chain to prevent any form of circular referrals
   - Example: If A refers B, and B refers C, then C cannot refer A

Users can check if they qualify as referrers using the `canReferOthers(address)` function, which returns a boolean value.

## Referral Rewards Tracking

The system tracks two key metrics for referral rewards:

1. **Pending Rewards**: Available through `getClaimableReferralRewards(address)` - shows unclaimed rewards
2. **Total Collected Rewards**: Available through `getUserCollectedReferrals(address)` - shows the lifetime total of claimed rewards

When a user claims referral rewards using `claimReferralRewards()`, the system:

- Transfers the tokens to the user's wallet
- Updates the claimed amount in the referral data structure
- Updates the TotalCollectedReferral field for historical tracking
- Emits a ReferralRewardsClaimed event

This dual tracking system allows the frontend to display both pending and historical reward information for users.

## Referral Rules and Restrictions

1. **Duplicate Referrals**

   - Each user can only be referred once
   - Once a user has used a referral code, they cannot change it or be referred by another user
   - The contract enforces this with: `require(!hasUsedReferral[msg.sender], "Already referred");`

2. **Circular Referrals**

   - Circular referrals at any level are not allowed
   - The contract checks for circularity by:
     - Ensuring a referrer hasn't been referred by the current user
     - Traversing the entire referral chain to check if the current user appears anywhere
   - Example of a circular referral attempt: A refers B, B refers C, C attempts to refer A (prohibited)

3. **Contract Address Referrals**

   - Contract addresses cannot be used as referrers
   - The system uses `SaleUtils.isContract()` to check if an address belongs to a contract
   - This prevents potential attack vectors using malicious contracts

4. **Self-Referrals**
   - Users cannot refer themselves
   - Enforced by: `require(_referrer != address(0) && _referrer != msg.sender, "Invalid referrer");`

## Technical Implementation

### Data Structures

```solidity
// Referral data structure
struct ReferralData {
    address referrer;                 // Address of the user's referrer
    uint256 totalReferralRewards;     // Total rewards earned
    uint256 claimedReferralRewards;   // Rewards already claimed
    bool hasReferred;                 // Flag to check if user has made at least one referral
    uint256 referralCount;            // Track number of successful referrals
}

// Referral system mappings
mapping(address => ReferralData) public referralData;
mapping(address => bool) public hasQualifiedPurchase;  // Track if user has purchased enough to qualify as referrer
mapping(address => bool) public hasUsedReferral;       // Prevent using multiple referrals
```

### Core Functions

1. **Recording Referrals**

   - The `recordReferral` function handles setting up referral relationships
   - Performs multiple validation checks
   - Updates both `referralData` and `users` structures for consistency
   - Called internally during token purchases with a referrer

2. **Processing Rewards**

   - The `processReferralRewards` function calculates and assigns rewards
   - Executed during token purchases
   - Updates reward stats for both referrer and referee
   - Rewards are calculated as: `tokenAmount * referralRewardPercentage / 100`

3. **Claiming Rewards**
   - The `claimReferralRewards` function allows users to claim accumulated rewards
   - Implements reentrancy protection with the `nonReentrant` modifier
   - Verifies contract has sufficient tokens before transfer
   - Updates the claimed amount to prevent double-claiming

## Frontend Integration

### Methods for Frontend Use

1. **Check if a User Can Refer Others**

   ```solidity
   function canReferOthers(address _user) external view returns (bool)
   ```

   - Returns `true` if the user has purchased enough tokens to qualify as a referrer
   - Used to determine if a user should be shown a referral link to share

2. **Check if a User Can Be Referred by a Specific Referrer**

   ```solidity
   function canBeReferred(address _referrer, address _referee)
       external view returns (bool canBeReferred, uint8 reason)
   ```

   - Performs comprehensive validation for a potential referral relationship
   - Returns a boolean result and a reason code:
     - `0`: Can be referred
     - `1`: Already has a referrer
     - `2`: Circular referral (direct or indirect)
     - `3`: Referrer not qualified

3. **Get User's Referral Information**

   ```solidity
   function getUserReferralInfo(address _user) external view
       returns (
           address referrer,
           uint256 totalRewards,
           uint256 claimedRewards,
           uint256 pendingRewards,
           bool isQualifiedReferrer,
           uint256 referralCount
       )
   ```

   - Returns comprehensive referral information for a user
   - Used to display referral stats on user dashboard

4. **Get User's Collected Referral Rewards**

   ```solidity
   function getUserCollectedReferrals(address _user) external view returns (uint256)
   ```

   - Returns the total amount of referral rewards a user has collected
   - This shows the total historical rewards, including those already claimed

5. **Get Referral Chain**

   ```solidity
   function getReferralChain(address _user) external view returns (address[] memory)
   ```

   - Returns the entire chain of referrals starting from the user up to the top referrer
   - Useful for visualizing referral trees or verifying referral relationships

6. **Get Referral Program Statistics**
   ```solidity
   function getReferralProgramStats() external view
       returns (
           uint256 currentPercentage,
           uint256 totalRewardsIssued,
           uint256 maxRewards,
           uint256 remainingRewards,
           uint256 nextPercentageChangeAllowed
       )
   ```
   - Returns global statistics for the referral program
   - Useful for displaying program status on the website

## Using Referrals When Purchasing Tokens

To use a referral when purchasing tokens, users can:

1. Call `buyWithUSDT(uint256 usdAmount, address referrer, bool shouldStake)` specifying the referrer's address
2. Call `buyWithEth(address referrer, bool shouldStake)` when purchasing with ETH

The contract will automatically:

1. Validate the referral relationship
2. Record the referral if it's the first purchase
3. Process referral rewards for both parties
4. Track referral statistics

## Security Considerations

1. **Gas Limit for Deep Chains**

   - Extremely long referral chains could potentially hit block gas limits
   - In practice, this is unlikely as it would require an extraordinary number of levels

2. **Contract Address Check**

   - The system prevents contract addresses from being used as referrers
   - This prevents potential attack vectors using malicious contracts

3. **Minimum Purchase Requirement**

   - Users must make a minimum purchase to qualify as referrers
   - Prevents gaming the system with multiple small accounts

4. **Reward Caps**
   - The total referral rewards are capped at 5% of the token supply
   - Individual reward percentage is capped at 20%
   - Protects the tokenomics of the project

## Example Referral Flow

1. User A purchases 1,000 tokens without a referrer

   - User A now qualifies as a referrer

2. User B purchases tokens using User A as a referrer

   - User A gets referral rewards
   - User B also gets referral rewards
   - User B can now qualify as a referrer if they purchased enough tokens

3. User C purchases tokens using User B as a referrer
   - User B gets referral rewards
   - User C also gets referral rewards
   - User C cannot use User A as a referrer (already used User B)
   - User A cannot use User C as a referrer (would create a circular referral)

## Conclusion

The referral system provides a secure and comprehensive solution for tracking and rewarding referrals during the presale. The implementation includes safeguards against common attack vectors and prevents any form of circular or duplicate referrals. The provided frontend integration methods make it easy to incorporate the referral system into the website or dApp interface.
