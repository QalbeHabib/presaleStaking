// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Sale Interfaces and Common Structures
 * @notice Shared structures for Sale contracts
 */
interface ISaleStructs {
    // Constants
    function PERCENT_DENOMINATOR() external view returns (uint256);
    function TOKEN_DECIMALS() external view returns (uint256);
    
    // Data Structures
    struct PresaleInfo {
        uint256 cap;
        uint256 price;
        uint256 sold;
        uint256 startTime;
        uint256 endTime;
        bool ClaimAble;
        bool isClosed;
    }
    
    struct User {
        uint256 TotalBoughtTokens;
        uint256 TotalPaid;
        uint256 TotalCollectedReferral;
        address[] referredUsers;
        address referrer;
    }
    
    struct Presale {
        uint256 startTime;
        uint256 endTime;
        uint256 price;
        uint256 nextStagePrice;
        uint256 Sold;
        uint256 tokensToSell;
        uint256 UsdtHardcap;
        uint256 amountRaised;
        bool Active;
        bool isEnableClaim;
    }

    struct ClaimData {
        uint256 claimAt;
        uint256 totalAmount;
        uint256 claimedAmount;
    }

    struct ReferralData {
        address referrer;
        uint256 totalReferralRewards;
        uint256 claimedReferralRewards;
        bool hasReferred;
        uint256 referralCount;
    }
    
    struct StakeInfo {
        uint256 stakedAmount;
        uint256 stakingTimestamp;
        uint256 unlockTimestamp;
        bool hasWithdrawn;
    }
    
    // Events (common)
    event PresaleCreated(
        uint256 indexed _id,
        uint256 _totalTokens,
        uint256 _startTime,
        uint256 _endTime
    );
    
    event TokensBought(
        address indexed user,
        uint256 indexed id,
        address indexed purchaseToken,
        uint256 tokensBought,
        uint256 amountPaid,
        uint256 timestamp
    );
    
    event TokensClaimedWithTimestamp(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 timestamp
    );
    
    event TokensPreFunded(
        address indexed token, 
        uint256 amount, 
        uint256 timestamp
    );
} 