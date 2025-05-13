// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReferralManager.sol";

/**
 * @title Staking Manager Contract
 * @notice This contract handles token staking functionality
 */
contract StakingManager is ReferralManager {
    
    // Staking system constants and variables
    uint256 public constant STAKING_APY = 200; // 200% APY
    uint256 public totalStaked;
    uint256 public stakingCap; // Cap at 6,666,666,667 tokens
    bool public stakingActive;
    uint256 public totalStakingRewardsIssued;
    
    // Staking system mappings
    mapping(address => ISaleStructs.StakeInfo) public userStakes;
    
    // Mapping to track users who want to stake ALL their tokens upon claim
    mapping(address => bool) public userStakingIntent;

    // New Staking Events
    event TokensStaked(
        address indexed user, 
        uint256 amount, 
        uint256 stakingTime, 
        uint256 unlockTime
    );

    event StakeWithdrawn(
        address indexed user, 
        uint256 stakedAmount, 
        uint256 rewardAmount, 
        uint256 timestamp
    );

    event StakingStatusChanged(
        bool isActive,
        uint256 timestamp
    );
    
    event StakingCapUpdated(
        uint256 previousCap,
        uint256 newCap,
        uint256 timestamp
    );
    
    // Define custom errors at contract level
    error StakingInactive();
    error ZeroAmount();
    error CapExceeded();
    error RewardLimitExceeded();
    error LockedStakeExists();
    error TransferFailed();
    
    /**
     * @dev Constructor initializes staking parameters
     */
    constructor(
        address _oracle,
        address _usdt,
        address _saleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) 
        ReferralManager(_oracle, _usdt, _saleToken, _MinTokenTobuy, _totalTokenSupply) 
    {
        // Initialize staking parameters
        stakingCap = 6666666667 * 10**18; // 6,666,666,667 tokens
        stakingActive = true; // Staking is active by default
    }
    
    /**
     * @dev Calculate total reserved tokens across all systems (referrals and staking)
     * @return Total reserved tokens that can't be withdrawn
     */
    function calculateTotalReservedTokens() public view returns (uint256) {
        // Reserved for referral rewards already issued
        uint256 referralReserved = totalReferralRewardsIssued;
        
        // Reserved for active stakes plus their potential rewards
        uint256 stakingReserved = totalStaked * (STAKING_APY + 100) / 100;
        
        return referralReserved + stakingReserved;
    }
    
    /**
     * @dev Override withdraw all tokens to account for staking rewards
     */
    function WithdrawAllTokens(address _token) external override onlyOwner {
        if (_token == SaleToken) {
            // Get total reserved tokens from the calculation function
            uint256 reservedTokens = calculateTotalReservedTokens();
            
            // Get current contract balance
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            
            // Calculate available amount to withdraw
            uint256 availableAmount = contractBalance > reservedTokens ? contractBalance - reservedTokens : 0;
            require(availableAmount > 0, "No tokens available to withdraw");
            
            // Transfer available tokens
            bool success = IERC20(_token).transfer(fundReceiver, availableAmount);
            require(success, "Transfer failed");
        } else {
            // For other tokens, withdraw all
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(contractBalance > 0, "No tokens to withdraw");
            
            bool success = IERC20(_token).transfer(fundReceiver, contractBalance);
            require(success, "Transfer failed");
        }
    }
    
    /**
     * @dev Safe withdrawal function for accumulated tokens
     * @param _token Token address
     * @param _amount Amount to withdraw
     * @param _recipient Recipient address
     */
    function safeWithdraw(address _token, uint256 _amount, address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        
        if (_token == SaleToken) {
            // Use the same calculation function for consistency
            uint256 reservedTokens = calculateTotalReservedTokens();
            
            // Check we're not withdrawing reserved tokens
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(contractBalance - _amount >= reservedTokens, "Reserved tokens");
        }
        
        bool withdrawSuccess = IERC20(_token).transfer(_recipient, _amount);
        require(withdrawSuccess, "Transfer failed");
    }
    
    /**
     * @dev Toggle staking status (active/inactive)
     */
    function setStakingStatus(bool _status) external onlyOwner {
        stakingActive = _status;
        emit StakingStatusChanged(_status, block.timestamp);
    }

    /**
     * @dev Helper function that handles token staking directly during purchase
     */
    function _handleTokenStaking(address _user, uint256 _amount) internal {
        // Ensure staking is active
        require(stakingActive, "Staking inactive");
        require(_amount > 0, "Zero amount");
        require(totalStaked + _amount <= stakingCap, "Cap exceeded");
        
        // Calculate potential rewards to verify we stay within the rewards limit
        uint256 potentialReward = _amount * STAKING_APY / 100;
        require(totalStakingRewardsIssued + potentialReward <= maxStakingRewards(), "Reward limit");
        
        // Update global state for staking
        totalStaked += _amount;
        totalStakingRewardsIssued += potentialReward;
        
        // Auto-disable staking if cap is reached
        if (totalStaked >= stakingCap) {
            stakingActive = false;
            emit StakingStatusChanged(false, block.timestamp);
        }
        
        // Update user stake
        ISaleStructs.StakeInfo storage userStake = userStakes[_user];
        
        // If user already has a stake, handle appropriately
        if (userStake.stakedAmount > 0 && !userStake.hasWithdrawn) {
            // If existing stake is still locked, cannot add to it
            if (block.timestamp < userStake.unlockTimestamp) {
                revert LockedStakeExists();
            } else {
                // Existing stake is unlocked, withdraw it first
                _processUnlockedStake(_user, userStake);
            }
        }
        
        // Create a new stake
        _createNewStake(_user, _amount, userStake);
    }
    
    /**
     * @dev Process an unlocked stake by returning principal + rewards
     */
    function _processUnlockedStake(address _user, ISaleStructs.StakeInfo storage userStake) private {
        uint256 stakedAmount = userStake.stakedAmount;
        uint256 reward = stakedAmount * STAKING_APY / 100;
        
        // Mark as withdrawn to prevent double-dipping
        userStake.hasWithdrawn = true;
        
        // Transfer rewards and original stake back
        bool transferSuccess = IERC20(SaleToken).transfer(_user, stakedAmount + reward);
        require(transferSuccess, "Withdrawal failed");
        
        emit StakeWithdrawn(_user, stakedAmount, reward, block.timestamp);
    }
    
    /**
     * @dev Create a new stake for a user
     */
    function _createNewStake(address _user, uint256 _amount, ISaleStructs.StakeInfo storage userStake) internal {
        userStake.stakedAmount = _amount;
        userStake.stakingTimestamp = block.timestamp;
        userStake.unlockTimestamp = block.timestamp + 365 days;
        userStake.hasWithdrawn = false;
        
        emit TokensStaked(_user, _amount, block.timestamp, userStake.unlockTimestamp);
    }

    /**
     * @dev Stake tokens with 1-year lock and 200% APY
     */
    function stakeTokens(uint256 _amount) external nonReentrant {
        if (!stakingActive) revert StakingInactive();
        if (_amount == 0) revert ZeroAmount();
        if (totalStaked + _amount > stakingCap) revert CapExceeded();
        
        // Cache rewards calculation
        uint256 potentialReward = _amount * STAKING_APY / 100;
        require(totalStakingRewardsIssued + potentialReward <= maxStakingRewards(), "Reward limit");
        
        // Update state once
        totalStaked += _amount;
        totalStakingRewardsIssued += potentialReward;
        
        // Auto-disable staking if cap is reached
        if (totalStaked >= stakingCap) {
            stakingActive = false;
            emit StakingStatusChanged(false, block.timestamp);
        }
        
        // Update user stake
        ISaleStructs.StakeInfo storage userStake = userStakes[msg.sender];
        
        if (userStake.stakedAmount > 0 && !userStake.hasWithdrawn) {
            require(block.timestamp >= userStake.unlockTimestamp, "Locked stake");
            
            // Withdraw previous stake first (internally)
            _processUnlockedStake(msg.sender, userStake);
        }
        
        // Create a new stake
        _createNewStake(msg.sender, _amount, userStake);
        
        // Transfer tokens from user to contract
        _transferStakedTokens(msg.sender, _amount);
    }
    
    /**
     * @dev Transfer tokens from user to contract for staking
     */
    function _transferStakedTokens(address _user, uint256 _amount) internal {
        uint256 balanceBefore = IERC20(SaleToken).balanceOf(address(this));
        bool transferSuccess = IERC20(SaleToken).transferFrom(_user, address(this), _amount);
        require(transferSuccess, "Transfer failed");
        
        // Verify tokens were actually received (protection against fee-on-transfer tokens)
        uint256 balanceAfter = IERC20(SaleToken).balanceOf(address(this));
        require(balanceAfter >= balanceBefore + _amount, "Incorrect amount");
    }
    
    /**
     * @dev Withdraw staked tokens and rewards after lock period
     */
    function withdrawStake() external nonReentrant {
        ISaleStructs.StakeInfo storage userStake = userStakes[msg.sender];
        
        require(userStake.stakedAmount > 0, "No stake found");
        require(!userStake.hasWithdrawn, "Already withdrawn");
        require(block.timestamp >= userStake.unlockTimestamp, "Still locked");
        
        uint256 stakedAmount = userStake.stakedAmount;
        uint256 reward = stakedAmount * STAKING_APY / 100;
        uint256 totalAmount = stakedAmount + reward;
        
        // Mark as withdrawn to prevent double-dipping
        userStake.hasWithdrawn = true;
        
        // Update global state
        totalStaked = totalStaked - stakedAmount;
        
        // Verify there are enough tokens in the contract
        require(totalAmount <= IERC20(SaleToken).balanceOf(address(this)), "Insufficient funds");
        
        // Transfer rewards and original stake
        bool withdrawSuccess = IERC20(SaleToken).transfer(msg.sender, totalAmount);
        require(withdrawSuccess, "Transfer failed");
        
        emit StakeWithdrawn(msg.sender, stakedAmount, reward, block.timestamp);
    }
    
    /**
     * @dev Get user staking information
     */
    function getUserStakingInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 stakingTime,
        uint256 unlockTime,
        bool isLocked,
        bool hasWithdrawn,
        uint256 potentialReward,
        uint256 totalClaimable
    ) {
        ISaleStructs.StakeInfo storage stake = userStakes[_user];
        bool locked = block.timestamp < stake.unlockTimestamp;
        uint256 reward = stake.stakedAmount * STAKING_APY / 100;
        
        return (
            stake.stakedAmount,
            stake.stakingTimestamp,
            stake.unlockTimestamp,
            locked,
            stake.hasWithdrawn,
            reward,
            stake.hasWithdrawn ? 0 : stake.stakedAmount + reward
        );
    }
    
    /**
     * @dev Get staking program statistics
     */
    function getStakingStats() external view returns (
        uint256 _totalStaked,
        uint256 _stakingCap,
        uint256 _stakingAPY,
        bool _isActive,
        uint256 _maxRewards,
        uint256 _totalRewardsCommitted,
        uint256 _remainingRewards
    ) {
        return (
            totalStaked,
            stakingCap,
            STAKING_APY,
            stakingActive,
            maxStakingRewards(),
            totalStakingRewardsIssued,
            maxStakingRewards() - totalStakingRewardsIssued
        );
    }

    /**
     * @dev Quick check if staking is available and capacity info
     */
    function getStakingAvailability() external view returns (
        bool _canStake,
        uint256 _remainingCapacity,
        uint256 _percentFilled
    ) {
        bool canStake = stakingActive && totalStaked < stakingCap;
        uint256 remainingCapacity = stakingCap > totalStaked ? stakingCap - totalStaked : 0;
        uint256 percentFilled = totalStaked * 100 / stakingCap;
        
        return (canStake, remainingCapacity, percentFilled);
    }
    
    /**
     * @dev Update staking cap
     */
    function updateStakingCap(uint256 _newCap) external onlyOwner {
        require(_newCap >= totalStaked, "Below total staked");
        
        uint256 oldCap = stakingCap;
        stakingCap = _newCap;
        
        emit StakingCapUpdated(oldCap, _newCap, block.timestamp);
    }
    
    /**
     * @dev Set staking intent for a user
     * @param _intent Whether to stake tokens upon claim
     */
    function setStakingIntent(bool _intent) external {
        userStakingIntent[msg.sender] = _intent;
    }
 
} 