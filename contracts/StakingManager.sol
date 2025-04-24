// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Import SaleBase 
import "./SaleBase.sol";

/**
 * @title Staking Manager Contract
 * @notice This contract handles token staking functionality
 */
contract StakingManager is SaleBase {
    // Keep some constants to maintain internal functionality
    uint256 internal constant TOKEN_DECIMALS_INT = 10**18;
    uint256 internal constant PERCENT_DENOMINATOR_INT = 100;
    
    // Staking system constants and variables
    uint256 public constant STAKING_LOCK_PERIOD = 365 days; // 365 days
    uint256 public constant STAKING_APY = 200; // 200% APY
    uint256 public totalStaked;
    uint256 public stakingCap; // Cap at 6,666,666,667 tokens
    bool public stakingActive;
    uint256 public totalStakingRewardsIssued;
    
    // Maximum staking rewards allocation (shadows the one in SaleBase)
    uint256 private _maxStakingRewards;
    
    // Staking data structure
    struct StakeInfo {
        uint256 stakedAmount;
        uint256 stakingTimestamp;
        uint256 unlockTimestamp;
        bool hasWithdrawn;
    }
    
    // Staking system mappings
    mapping(address => StakeInfo) public userStakes;

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
    
    /**
     * @dev Constructor initializes staking and sale parameters
     * @param _oracle Chainlink oracle for ETH price feed
     * @param _usdt USDT token address
     * @param _saleToken Sale token address
     * @param _MinTokenTobuy Minimum tokens that can be purchased
     * @param _totalTokenSupply Total token supply
     */
    constructor(
        address _oracle,
        address _usdt,
        address _saleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) 
        SaleBase(_oracle, _usdt, _saleToken, _MinTokenTobuy, _totalTokenSupply) 
    {
        // Initialize staking parameters
        stakingCap = 6666666667 * TOKEN_DECIMALS_INT; // 6,666,666,667 tokens
        stakingActive = true; // Staking is active by default
        
        // Calculate maximum staking rewards (20% of total supply)
        _maxStakingRewards = _totalTokenSupply * 20 / PERCENT_DENOMINATOR_INT;
    }
    
    /**
     * @dev Maximum available tokens for staking rewards (20% of total supply)
     * @return The maximum number of tokens available for staking rewards
     */
    function maxStakingRewards() public view override returns (uint256) {
        return _maxStakingRewards;
    }
    
    /**
     * @dev Toggle staking status (active/inactive)
     * @param _status New staking status
     */
    function setStakingStatus(bool _status) external onlyOwner {
        stakingActive = _status;
        emit StakingStatusChanged(_status, block.timestamp);
    }

    /**
     * @dev Helper function that handles token staking directly during purchase
     * @param _user Address of the user
     * @param _amount Amount of tokens to stake
     * @notice This function is called automatically during purchase if staking is selected
     * @notice Tokens are locked for 365 days with 200% APY
     */
    function _handleTokenStaking(address _user, uint256 _amount) internal {
        // Ensure staking is active
        require(stakingActive, "Staking is not active");
        require(_amount > 0, "Cannot stake zero amount");
        require(
            totalStaked + _amount <= stakingCap,
            "Staking cap would be exceeded"
        );
        
        // Calculate potential rewards to verify we stay within the rewards limit
        uint256 potentialReward = _amount * STAKING_APY / PERCENT_DENOMINATOR_INT;
        require(
            totalStakingRewardsIssued + potentialReward <= maxStakingRewards(),
            "Not enough tokens in the staking reward pool"
        );
        
        // Update global state for staking
        totalStaked = totalStaked + _amount;
        totalStakingRewardsIssued = totalStakingRewardsIssued + potentialReward;
        
        // Auto-disable staking if cap is reached
        if (totalStaked >= stakingCap) {
            stakingActive = false;
            emit StakingStatusChanged(false, block.timestamp);
        }
        
        // Update user stake
        StakeInfo storage userStake = userStakes[_user];
        
        // If user already has a stake, handle appropriately
        if (userStake.stakedAmount > 0 && !userStake.hasWithdrawn) {
            // If existing stake is still locked, cannot add to it
            if (block.timestamp < userStake.unlockTimestamp) {
                revert("Cannot stake when you have a locked stake");
            } else {
                // Existing stake is unlocked, withdraw it first
                uint256 stakedAmount = userStake.stakedAmount;
                uint256 reward = stakedAmount * STAKING_APY / PERCENT_DENOMINATOR_INT;
                
                // Mark as withdrawn to prevent double-dipping
                userStake.hasWithdrawn = true;
                
                // Transfer rewards and original stake back
                bool transferSuccess = IERC20(SaleToken).transfer(_user, stakedAmount + reward);
                require(transferSuccess, "Stake withdrawal failed");
                
                emit StakeWithdrawn(_user, stakedAmount, reward, block.timestamp);
            }
        }
        
        // Create a new stake
        userStake.stakedAmount = _amount;
        userStake.stakingTimestamp = block.timestamp;
        userStake.unlockTimestamp = block.timestamp + STAKING_LOCK_PERIOD;
        userStake.hasWithdrawn = false;
        
        emit TokensStaked(_user, _amount, block.timestamp, userStake.unlockTimestamp);
    }

    /**
     * @dev Stake tokens with 1-year lock and 200% APY
     * @param _amount Amount of tokens to stake
     */
    function stakeTokens(uint256 _amount) external nonReentrant {
        require(stakingActive, "Staking is not active");
        require(_amount > 0, "Cannot stake zero amount");
        require(
            totalStaked + _amount <= stakingCap,
            "Staking cap would be exceeded"
        );
        
        // Calculate potential rewards to verify we stay within the rewards limit
        uint256 potentialReward = _amount * STAKING_APY / PERCENT_DENOMINATOR_INT;
        require(
            totalStakingRewardsIssued + potentialReward <= maxStakingRewards(),
            "Not enough tokens in the staking reward pool"
        );
        
        // Update global state
        totalStaked = totalStaked + _amount;
        totalStakingRewardsIssued = totalStakingRewardsIssued + potentialReward;
        
        // Auto-disable staking if cap is reached
        if (totalStaked >= stakingCap) {
            stakingActive = false;
            emit StakingStatusChanged(false, block.timestamp);
        }
        
        // Update user stake
        StakeInfo storage userStake = userStakes[msg.sender];
        
        // If user already has a stake, we need special handling
        if (userStake.stakedAmount > 0 && !userStake.hasWithdrawn) {
            require(
                block.timestamp >= userStake.unlockTimestamp,
                "Cannot add to existing stake while locked"
            );
            
            // Withdraw previous stake first (internally)
            uint256 stakedAmount = userStake.stakedAmount;
            uint256 reward = stakedAmount * STAKING_APY / PERCENT_DENOMINATOR_INT;
            
            // Mark as withdrawn to prevent double-dipping
            userStake.hasWithdrawn = true;
            
            // Transfer rewards and original stake back
            bool transferSuccess = IERC20(SaleToken).transfer(msg.sender, stakedAmount + reward);
            require(transferSuccess, "Token transfer failed");
            
            // Create a new stake
            userStake.stakedAmount = _amount;
            userStake.stakingTimestamp = block.timestamp;
            userStake.unlockTimestamp = block.timestamp + STAKING_LOCK_PERIOD;
            userStake.hasWithdrawn = false;
        } else {
            // First time stake or previous stake was withdrawn
            userStake.stakedAmount = _amount;
            userStake.stakingTimestamp = block.timestamp;
            userStake.unlockTimestamp = block.timestamp + STAKING_LOCK_PERIOD;
            userStake.hasWithdrawn = false;
        }
        
        // Transfer tokens from user to contract (SafeERC20 pattern)
        uint256 balanceBefore = IERC20(SaleToken).balanceOf(address(this));
        bool transferFromSuccess = IERC20(SaleToken).transferFrom(msg.sender, address(this), _amount);
        require(transferFromSuccess, "Token transfer failed");
        
        // Verify tokens were actually received (protection against fee-on-transfer tokens)
        uint256 balanceAfter = IERC20(SaleToken).balanceOf(address(this));
        require(balanceAfter >= balanceBefore + _amount, "Incorrect amount of tokens received");
        
        emit TokensStaked(msg.sender, _amount, block.timestamp, userStake.unlockTimestamp);
    }
    
    /**
     * @dev Withdraw staked tokens and rewards after lock period
     */
    function withdrawStake() external nonReentrant {
        StakeInfo storage userStake = userStakes[msg.sender];
        
        require(userStake.stakedAmount > 0, "No stake found");
        require(!userStake.hasWithdrawn, "Already withdrawn");
        require(
            block.timestamp >= userStake.unlockTimestamp,
            "Stake is still locked"
        );
        
        uint256 stakedAmount = userStake.stakedAmount;
        uint256 reward = stakedAmount * STAKING_APY / PERCENT_DENOMINATOR_INT;
        uint256 totalAmount = stakedAmount + reward;
        
        // Mark as withdrawn to prevent double-dipping
        userStake.hasWithdrawn = true;
        
        // Update global state
        totalStaked = totalStaked - stakedAmount;
        
        // Verify there are enough tokens in the contract
        require(
            totalAmount <= IERC20(SaleToken).balanceOf(address(this)),
            "Not enough tokens in the contract"
        );
        
        // Transfer rewards and original stake
        bool withdrawSuccess = IERC20(SaleToken).transfer(msg.sender, totalAmount);
        require(withdrawSuccess, "Token transfer failed");
        
        emit StakeWithdrawn(msg.sender, stakedAmount, reward, block.timestamp);
    }
    
    /**
     * @dev Get user staking information
     * @param _user Address of the user
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
        StakeInfo storage stake = userStakes[_user];
        bool locked = block.timestamp < stake.unlockTimestamp;
        uint256 reward = stake.stakedAmount * STAKING_APY / PERCENT_DENOMINATOR_INT;
        
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
     * @return _canStake True if staking is active and cap not reached
     * @return _remainingCapacity Remaining capacity for staking
     * @return _percentFilled Percentage of staking capacity filled (0-100)
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
     * @param _newCap New staking cap
     */
    function updateStakingCap(uint256 _newCap) external onlyOwner {
        require(_newCap >= totalStaked, "New cap must be >= total staked");
        
        uint256 oldCap = stakingCap;
        stakingCap = _newCap;
        
        emit StakingCapUpdated(oldCap, _newCap, block.timestamp);
    }
    
    /**
     * @dev Safe withdrawal function for accumulated tokens
     * @param _token Token address
     * @param _amount Amount to withdraw
     * @param _recipient Recipient address
     */
    function safeWithdraw(address _token, uint256 _amount, address _recipient) external onlyOwner {
        require(_recipient != address(0), "Cannot withdraw to zero address");
        
        if (_token == SaleToken) {
            // Calculate tokens needed for staking rewards
            uint256 reservedForStaking = totalStaked * (STAKING_APY + 100) / PERCENT_DENOMINATOR_INT;
            
            // Check we're not withdrawing reserved tokens
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(
                contractBalance - _amount >= reservedForStaking,
                "Cannot withdraw tokens reserved for staking rewards"
            );
        }
        
        bool withdrawSuccess = IERC20(_token).transfer(_recipient, _amount);
        require(withdrawSuccess, "Token transfer failed");
    }
} 