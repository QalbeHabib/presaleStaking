// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SaleBase.sol";
import "./libraries/SaleUtils.sol";

/**
 * @title Referral Manager Contract
 * @notice This contract handles token referral functionality
 */
contract ReferralManager is SaleBase {
    // Referral system constants and variables
    uint256 public constant MINIMUM_PURCHASE_FOR_REFERRAL = 1000 * 10**18; // 1000 tokens minimum to qualify for referral
    uint256 public referralRewardPercentage = 20; // Default 20% reward (configurable)
    uint256 public totalReferralRewardsIssued;

    // Anti-gaming time lock for referral changes
    uint256 public referralPercentageChangeTimeLock;

    // Referral system mappings
    mapping(address => ISaleStructs.ReferralData) public referralData;
    mapping(address => bool) public hasQualifiedPurchase; // Track if user has purchased enough to qualify as referrer
    mapping(address => bool) public hasUsedReferral; // Prevent using multiple referrals

    // Referral Events
    event ReferralRecorded(
        address indexed referrer, 
        address indexed referee, 
        uint256 timestamp
    );
    
    event ReferralRewardsClaimed(
        address indexed user, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event ReferralPercentageUpdated(
        uint256 previousPercentage, 
        uint256 newPercentage, 
        uint256 timestamp
    );
    
    event ReferralRewardsAdded(
        address indexed referrer, 
        address indexed referee, 
        uint256 referrerReward, 
        uint256 refereeReward, 
        uint256 timestamp
    );

    /**
     * @dev Constructor initializes with same parameters as SaleBase
     */
    constructor(
        address _oracle,
        address _usdt,
        address _SaleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) 
        SaleBase(_oracle, _usdt, _SaleToken, _MinTokenTobuy, _totalTokenSupply) 
    {
        // Initialize referral-specific parameters
        referralPercentageChangeTimeLock = block.timestamp;
    }

    /**
     * @dev Override withdraw to account for referral rewards
     */
    function WithdrawTokens(address _token, uint256 amount) external virtual override onlyOwner {
        if (_token == SaleToken) {
            // Calculate tokens needed for rewards
            uint256 reservedTokens = totalReferralRewardsIssued;
            
            // Check we're not withdrawing reserved tokens
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(
                contractBalance - amount >= reservedTokens,
                "Cannot withdraw tokens reserved for rewards"
            );
        }
        
        bool success = IERC20(_token).transfer(fundReceiver, amount);
        require(success, "Token transfer failed");
    }

    /**
     * @dev Change referral reward percentage with timelock protection
     * @param _percentage New percentage (1-20)
     */
    function updateReferralRewardPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage > 0 && _percentage <= 20, "Invalid percentage");
        require(block.timestamp >= referralPercentageChangeTimeLock, "Timelock active");
        
        // Set new timelock for future changes
        referralPercentageChangeTimeLock = block.timestamp + 24 hours;
        
        uint256 oldPercentage = referralRewardPercentage;
        referralRewardPercentage = _percentage;
        
        emit ReferralPercentageUpdated(oldPercentage, _percentage, block.timestamp);
    }

    /**
     * @dev Records a valid referral relationship
     * @param _referrer Address of the referrer
     */
    function recordReferral(address _referrer) public {
        // Security checks
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(!hasUsedReferral[msg.sender], "Already used a referral");
        require(hasQualifiedPurchase[_referrer], "Referrer has not qualified");
        
        // Prevent circular referrals - Check if the referrer was referred by the current user
        require(referralData[_referrer].referrer != msg.sender, "Circular referral not allowed");
        
        // Also check deeper circular referrals by traversing the chain
        address currentReferrer = referralData[_referrer].referrer;
        while (currentReferrer != address(0)) {
            require(currentReferrer != msg.sender, "Circular referral chain detected");
            currentReferrer = referralData[currentReferrer].referrer;
        }
        
        // Record the referral relationship in both data structures for compatibility
        referralData[msg.sender].referrer = _referrer;
        users[msg.sender].referrer = _referrer;
        hasUsedReferral[msg.sender] = true;
        
        // Update referrer stats
        referralData[_referrer].hasReferred = true;
        referralData[_referrer].referralCount++;
        
        // Add user to referrer's referredUsers array in users struct
        bool alreadyReferred = false;
        for (uint i = 0; i < users[_referrer].referredUsers.length; i++) {
            if (users[_referrer].referredUsers[i] == msg.sender) {
                alreadyReferred = true;
                break;
            }
        }
        if (!alreadyReferred) {
            users[_referrer].referredUsers.push(msg.sender);
        }
        
        emit ReferralRecorded(_referrer, msg.sender, block.timestamp);
    }

    /**
     * @dev Process referral rewards after a successful purchase
     * @param _user Address of the user who made a purchase
     * @param _tokenAmount Amount of tokens purchased
     */
    function processReferralRewards(address _user, uint256 _tokenAmount) public {
        // Check if purchase meets minimum for referral qualification
        if (_tokenAmount >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            hasQualifiedPurchase[_user] = true;
        }
        
        // If user has a referrer, calculate and assign rewards
        address referrer = referralData[_user].referrer;
        if (referrer != address(0) && _tokenAmount >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            // Calculate rewards (both get the same percentage)
            uint256 referrerReward = _tokenAmount * referralRewardPercentage / 100;
            uint256 refereeReward = referrerReward; // Same reward for both parties
            
            // Check against the max referral rewards cap
            uint256 totalNewRewards = referrerReward + refereeReward;
            if (totalReferralRewardsIssued + totalNewRewards <= maxReferralRewards) {
                // Update referrer's rewards
                referralData[referrer].totalReferralRewards = 
                    referralData[referrer].totalReferralRewards + referrerReward;
                
                // Update referee's rewards
                referralData[_user].totalReferralRewards = 
                    referralData[_user].totalReferralRewards + refereeReward;
                
                // Update total rewards issued
                totalReferralRewardsIssued = totalReferralRewardsIssued + totalNewRewards;
                
                emit ReferralRewardsAdded(
                    referrer, 
                    _user, 
                    referrerReward, 
                    refereeReward, 
                    block.timestamp
                );
            }
        }
    }

    /**
     * @dev Get claimable referral rewards for a user
     * @param _user Address of the user
     */
    function getClaimableReferralRewards(address _user) public view returns (uint256) {
        ISaleStructs.ReferralData memory data = referralData[_user];
        return data.totalReferralRewards - data.claimedReferralRewards;
    }

    /**
     * @dev Claim referral rewards
     */
    function claimReferralRewards() external nonReentrant returns (bool) {
        uint256 amount = getClaimableReferralRewards(msg.sender);
        require(amount > 0, "No rewards to claim");
        
        // Verify there are enough tokens in the contract
        require(
            amount <= IERC20(SaleToken).balanceOf(address(this)),
            "Not enough tokens in the contract"
        );
        
        // Update claimed amount
        referralData[msg.sender].claimedReferralRewards = 
            referralData[msg.sender].claimedReferralRewards + amount;
        
        // Transfer tokens
        bool success = IERC20(SaleToken).transfer(msg.sender, amount);
        require(success, "Token transfer failed");
        
        emit ReferralRewardsClaimed(msg.sender, amount, block.timestamp);
        return true;
    }

    // Get user referral info for frontend
    function getUserReferralInfo(address _user) external view returns (
        address referrer,
        uint256 totalRewards,
        uint256 claimedRewards,
        uint256 pendingRewards,
        bool isQualifiedReferrer,
        uint256 referralCount
    ) {
        ISaleStructs.ReferralData memory data = referralData[_user];
        return (
            data.referrer,
            data.totalReferralRewards,
            data.claimedReferralRewards,
            data.totalReferralRewards - data.claimedReferralRewards,
            hasQualifiedPurchase[_user],
            data.referralCount
        );
    }

    // Get referral program stats
    function getReferralProgramStats() external view returns (
        uint256 currentPercentage,
        uint256 totalRewardsIssued,
        uint256 maxRewards,
        uint256 remainingRewards,
        uint256 nextPercentageChangeAllowed
    ) {
        return (
            referralRewardPercentage,
            totalReferralRewardsIssued,
            maxReferralRewards,
            maxReferralRewards - totalReferralRewardsIssued,
            referralPercentageChangeTimeLock
        );
    }

    /**
     * @dev Update the maximum referral rewards (5% of total supply)
     * @param _totalSupply The total token supply to calculate 5% from
     */
    function updateMaxReferralRewards(uint256 _totalSupply) external onlyOwner {
        require(_totalSupply > 0, "Invalid total supply");
        maxReferralRewards = _totalSupply * 5 / 100;
    }

    // Check if a user has a valid referral link to share
    function canReferOthers(address _user) external view returns (bool) {
        return hasQualifiedPurchase[_user];
    }

    /**
     * @dev Check if a user can be referred by a specific referrer
     */
    function canBeReferred(address _referrer, address _referee) external view returns (bool isEligible, uint8 reason) {
        // Check if user already has a referrer
        if (hasUsedReferral[_referee]) {
            return (false, 1); // Already has a referrer
        }
        
        // Check if referrer is the same as referee (self-referral)
        if (_referrer == _referee) {
            return (false, 2); // Self-referral not allowed
        }
        
        // Check if referrer is qualified
        if (!hasQualifiedPurchase[_referrer]) {
            return (false, 3); // Referrer not qualified
        }
        
        // Check first level circular referral (A refers B, B tries to refer A)
        if (referralData[_referrer].referrer == _referee) {
            return (false, 2); // Circular referral
        }
        
        // Check deeper circular referrals by traversing the chain
        address currentReferrer = referralData[_referrer].referrer;
        while (currentReferrer != address(0)) {
            if (currentReferrer == _referee) {
                return (false, 2); // Circular referral chain
            }
            currentReferrer = referralData[currentReferrer].referrer;
        }
        
        // All checks passed
        return (true, 0);
    }
    
    /**
     * @dev Get the entire referral chain for a user
     */
    function getReferralChain(address _user) external view returns (address[] memory) {
        // Count the depth of the referral chain
        uint256 chainDepth = 0;
        address current = _user;
        
        while (referralData[current].referrer != address(0)) {
            chainDepth++;
            current = referralData[current].referrer;
        }
        
        // Create array to hold the chain
        address[] memory chain = new address[](chainDepth + 1);
        
        // Fill the array
        chain[0] = _user;
        current = _user;
        for (uint256 i = 1; i <= chainDepth; i++) {
            current = referralData[current].referrer;
            chain[i] = current;
        }
        
        return chain;
    }
} 