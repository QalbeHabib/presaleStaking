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
    uint8 public referralRewardPercentage = 20; // Default 20% reward (configurable)
    uint256 public totalReferralRewardsIssued;

    // Anti-gaming time lock for referral changes
    uint256 public referralPercentageChangeTimeLock;

    // Referral system mappings
    mapping(address => ISaleStructs.ReferralData) public referralData;
    mapping(address => bool) public hasQualifiedPurchase; // Track if user has purchased enough to qualify as referrer
    mapping(address => bool) public hasUsedReferral; // Prevent using multiple referrals
    mapping(address => mapping(address => bool)) private referredUserExists;

    // Events
    event ReferralRecorded(address indexed referrer, address indexed referee, uint256 timestamp);
    event ReferralRewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event ReferralPercentageUpdated(uint256 previousPercentage, uint256 newPercentage, uint256 timestamp);
    event ReferralRewardsAdded(address indexed referrer, address indexed referee, uint256 referrerReward, uint256 refereeReward, uint256 timestamp);

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
        referralPercentageChangeTimeLock = block.timestamp;
    }

    /**
     * @dev Override the base calculation to include referral rewards
     */
    function calculateBaseReservedTokens() public view virtual override returns (uint256) {
        // Include referral rewards in the reserved tokens
        return totalReferralRewardsIssued;
    }

    /**
     * @dev Override withdraw all tokens to account for referral rewards
     */
    function WithdrawAllTokens(address _token) external virtual override onlyOwner {
        if (_token == SaleToken) {
            // Calculate tokens needed for rewards
            uint256 reservedTokens = calculateBaseReservedTokens();
            
            // Get current contract balance
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            
            // Calculate available amount to withdraw
            uint256 availableAmount = contractBalance > reservedTokens ? contractBalance - reservedTokens : 0;
            require(availableAmount > 0, "No tokens available to withdraw");
            
            // Transfer available tokens
            require(IERC20(_token).transfer(fundReceiver, availableAmount), "Token transfer failed");
        } else {
            // For other tokens, withdraw all
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(contractBalance > 0, "No tokens to withdraw");
            
            require(IERC20(_token).transfer(fundReceiver, contractBalance), "Token transfer failed");
        }
    }

    /**
     * @dev Change referral reward percentage with timelock protection
     * @param _percentage New percentage (1-20)
     */
    function updateReferralRewardPercentage(uint8 _percentage) external onlyOwner {
        require(_percentage > 0 && _percentage <= 20, "Invalid percentage");
        require(block.timestamp >= referralPercentageChangeTimeLock, "Timelock active");
        
        // Set new timelock for future changes
        referralPercentageChangeTimeLock = block.timestamp + 24 hours;
        
        emit ReferralPercentageUpdated(referralRewardPercentage, _percentage, block.timestamp);
        referralRewardPercentage = _percentage;
    }

    /**
     * @dev Records a valid referral relationship
     * @param _referrer Address of the referrer
     */
    function recordReferral(address _referrer) public {
        require(_referrer != address(0) && _referrer != msg.sender, "Invalid referrer");
        require(!hasUsedReferral[msg.sender], "Already referred");
        require(hasQualifiedPurchase[_referrer], "Unqualified referrer");
        
        // Prevent circular referrals
        require(referralData[_referrer].referrer != msg.sender, "Circular referral");
        
        // Check for circular chains
        address currentReferrer = referralData[_referrer].referrer;
        while (currentReferrer != address(0)) {
            require(currentReferrer != msg.sender, "Circular chain");
            currentReferrer = referralData[currentReferrer].referrer;
        }
        
        // Record the referral relationship
        referralData[msg.sender].referrer = _referrer;
        users[msg.sender].referrer = _referrer;
        hasUsedReferral[msg.sender] = true;
        
        // Update referrer stats
        ISaleStructs.ReferralData storage refData = referralData[_referrer];
        refData.hasReferred = true;
        refData.referralCount++;
        
        // Add user to referrer's referredUsers array
        if (!referredUserExists[_referrer][msg.sender]) {
            users[_referrer].referredUsers.push(msg.sender);
            referredUserExists[_referrer][msg.sender] = true;
        }
        
        emit ReferralRecorded(_referrer, msg.sender, block.timestamp);
    }

    /**
     * @dev Process referral rewards after a successful purchase
     * @param _user Address of the user who made a purchase
     * @param _tokenAmount Amount of tokens purchased
     */
    function processReferralRewards(address _user, uint256 _tokenAmount) public {
        if (_tokenAmount >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            hasQualifiedPurchase[_user] = true;
            
            address referrer = referralData[_user].referrer;
            if (referrer != address(0)) {
                // Calculate rewards
                uint256 referrerReward = _tokenAmount * referralRewardPercentage / 100;
                uint256 totalNewRewards = referrerReward * 2; // Both get same reward
                
                // Update rewards if under max cap
                if (totalReferralRewardsIssued + totalNewRewards <= maxReferralRewards) {
                    // Update referral data structs
                    referralData[referrer].totalReferralRewards += referrerReward;
                    referralData[_user].totalReferralRewards += referrerReward;
                    
                    // Update global rewards counter
                    totalReferralRewardsIssued += totalNewRewards;
                    
                    emit ReferralRewardsAdded(referrer, _user, referrerReward, referrerReward, block.timestamp);
                }
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
    function claimReferralRewards() public nonReentrant returns (bool) {
        // User can claim referral rewards only when presale is over
        require(!presale[presaleId].Active || presale[presaleId].endTime > 0, "Presale still active");
        require(presale[presaleId].isEnableClaim, "Claiming not enabled");

        uint256 amount = getClaimableReferralRewards(msg.sender);
        require(amount > 0, "No rewards to claim");
        
        // Verify there are enough tokens in the contract
        require(amount <= IERC20(SaleToken).balanceOf(address(this)), "Not enough tokens in contract");
        
        // Update claimed amount first to prevent reentrancy
        referralData[msg.sender].claimedReferralRewards += amount;
        
        // Update the total collected referral rewards in the users mapping
        users[msg.sender].TotalCollectedReferral += amount;
        
        // Transfer tokens
        require(IERC20(SaleToken).transfer(msg.sender, amount), "Token transfer failed");
        
        emit ReferralRewardsClaimed(msg.sender, amount, block.timestamp);
        return true;
    }

    /**
     * @dev Get user referral info for frontend
     */
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

    /**
     * @dev Get user's total collected referral rewards
     */
    function getUserCollectedReferrals(address _user) external view returns (uint256) {
        return users[_user].TotalCollectedReferral;
    }

    /**
     * @dev Get referral program stats
     */
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

    /**
     * @dev Check if a user has a valid referral link to share
     */
    function canReferOthers(address _user) external view returns (bool) {
        return hasQualifiedPurchase[_user];
    }

    /**
     * @dev Check if a user can be referred by a specific referrer
     */
    function canBeReferred(address _referrer, address _referee) external view returns (bool isEligible, uint8 reason) {
        if (hasUsedReferral[_referee]) return (false, 1); // Already referred
        if (_referrer == _referee) return (false, 2); // Self-referral
        if (!hasQualifiedPurchase[_referrer]) return (false, 3); // Unqualified referrer
        if (referralData[_referrer].referrer == _referee) return (false, 2); // Direct circular referral
        
        // Check for circular chain
        address currentReferrer = referralData[_referrer].referrer;
        while (currentReferrer != address(0)) {
            if (currentReferrer == _referee) return (false, 2); // Found in chain
            currentReferrer = referralData[currentReferrer].referrer;
        }
        
        return (true, 0); // Eligible
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