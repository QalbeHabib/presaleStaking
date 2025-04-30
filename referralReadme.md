# Presale Referral System Documentation

## Overview

The presale contract includes a comprehensive referral system that rewards both referrers and referees. This document outlines the implementation details, rules, and available functions for frontend integration.

## Key Features

1. **Single Referrer Policy**
   - Each user can only have one referrer throughout the presale
   - Once a referral relationship is established, it cannot Ibe changed

2. **Anti-Circular Referral Protection**
   - Prevents all forms of circular referrals
   - Checks for both direct circular referrals (A refers B, B cannot refer A)
   - Checks for multi-level circular referrals (A refers B, B refers C, C cannot refer A)

3. **Referral Rewards**
   - Both referrer and referee receive equal rewards
   - Default reward rate is 20% (configurable by owner)
   - Maximum reward percentage capped at 20%
   - Total referral rewards limited to 5% of total token supply

4. **Referrer Qualification**
   - Users must purchase at least 1,000 tokens to qualify as referrers
   - Prevents spam and gaming of the system

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

2. **Processing Rewards**
   - The `processReferralRewards` function calculates and assigns rewards
   - Executed during token purchases
   - Updates reward stats for both referrer and referee

3. **Claiming Rewards**
   - The `claimReferralRewards` function allows users to claim accumulated rewards
   - Implements reentrancy protection with the `nonReentrant` modifier
   - Verifies contract has sufficient tokens before transfer

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

4. **Get Referral Chain**
   ```solidity
   function getReferralChain(address _user) external view returns (address[] memory)
   ```
   - Returns the entire chain of referrals starting from the user up to the top referrer
   - Useful for visualizing referral trees or verifying referral relationships

5. **Get Referral Program Statistics**
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

## Implementation Details

### Referral Validation Process

When a user attempts to use a referral code (address) during purchase, the system performs the following checks:

1. Verify referrer address is not zero (`address(0)`)
2. Ensure referrer is not the same as the user (prevent self-referral)
3. Check that the user hasn't already used a referral code
4. Verify the referrer has qualified by making a minimum purchase
5. Check for circular referrals at any level (direct or through a chain)

If all checks pass, the referral relationship is recorded and rewards are processed.

### Usage Example in Frontend

```javascript
// Check if a user can be referred
async function checkReferralEligibility(referrerAddress, userAddress) {
  const [canBeReferred, reason] = await presaleContract.canBeReferred(referrerAddress, userAddress);
  
  if (!canBeReferred) {
    switch(reason) {
      case 1:
        return "You have already used a referral code";
      case 2:
        return "Circular referral detected. This would create a referral loop";
      case 3:
        return "This referrer has not qualified yet (minimum purchase required)";
      default:
        return "Unknown error";
    }
  }
  
  return "Valid referral code. You can use this to get bonus tokens!";
}

// Get user's referral stats for dashboard
async function getUserReferralStats(userAddress) {
  const stats = await presaleContract.getUserReferralInfo(userAddress);
  return {
    referrer: stats[0],
    totalRewards: ethers.utils.formatUnits(stats[1], 18),
    claimedRewards: ethers.utils.formatUnits(stats[2], 18),
    pendingRewards: ethers.utils.formatUnits(stats[3], 18),
    isQualifiedReferrer: stats[4],
    referralCount: stats[5].toNumber()
  };
}
```

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
   - Protects the tokenomics of the project

## Conclusion

The referral system provides a secure and comprehensive solution for tracking and rewarding referrals during the presale. The implementation includes safeguards against common attack vectors and prevents any form of circular referrals. The provided frontend integration methods make it easy to incorporate the referral system into the website or dApp interface. 