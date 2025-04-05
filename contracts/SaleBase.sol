// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface Aggregator {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title Sale Base Contract
 * @notice This contract handles the core presale and referral functionality
 */
contract SaleBase is ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    
    // Named constants for clarity
    uint256 public constant TOKEN_DECIMALS = 10**18;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant DAYS_PER_YEAR = 365;
    uint256 public constant PERCENT_DENOMINATOR = 100;
    
    uint256 public presaleId;
    uint256 public USDT_MULTIPLIER;
    uint256 public ETH_MULTIPLIER;
    address public fundReceiver;

    // Token allocation constants
    uint256 public constant PRESALE_ALLOCATION_PERCENT = 30;
    uint256 public constant REFERRAL_ALLOCATION_PERCENT = 5;
    uint256 public constant STAKING_ALLOCATION_PERCENT = 20;
    
    // Total supply and allocations
    uint256 public totalTokenSupply;
    uint256 public presaleTokens;
    uint256 public maxReferralRewards;
    uint256 private _maxStakingRewards; // Private state variable instead

    // Referral system constants and variables
    uint256 public constant MINIMUM_PURCHASE_FOR_REFERRAL = 1000 * TOKEN_DECIMALS; // 1000 tokens minimum to qualify for referral
    uint256 public referralRewardPercentage = 20; // Default 20% reward (configurable)
    uint256 public constant MAX_REFERRAL_PERCENTAGE = 20; // Maximum allowed reward percentage
    uint256 public totalReferralRewardsIssued;
    uint256 public constant REFERRAL_DENOMINATOR = 100; // For percentage calculations

    // Anti-gaming time lock for referral changes
    uint256 public referralPercentageChangeTimeLock;
    uint256 public constant REFERRAL_CHANGE_TIMELOCK = 24 hours;

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

    // Referral data structure
    struct ReferralData {
        address referrer;
        uint256 totalReferralRewards;
        uint256 claimedReferralRewards;
        bool hasReferred; // Flag to check if user has made at least one referral
        uint256 referralCount; // Track number of successful referrals
    }

    IERC20Metadata public USDTInterface;
    Aggregator internal aggregatorInterface;
    // https://docs.chain.link/docs/ethereum-addresses/ => (ETH / USD)

    mapping(uint256 => bool) public paused;
    mapping(uint256 => Presale) public presale;
    mapping(address => mapping(uint256 => ClaimData)) public userClaimData;
    mapping(address => bool) public isExcludeMinToken;
    
    // Referral system mappings
    mapping(address => ReferralData) public referralData;
    mapping(address => bool) public hasQualifiedPurchase; // Track if user has purchased enough to qualify as referrer
    mapping(address => bool) public hasUsedReferral; // Prevent using multiple referrals

    uint256 public MinTokenTobuy;
    address public SaleToken;

    // Mapping to track users who want to stake ALL their tokens upon claim
    mapping(address => bool) public userStakingIntent;

    // Track if the contract has been pre-funded
    bool public isTokenPreFunded = false;

    event TokensPreFunded(address indexed token, uint256 amount, uint256 timestamp);
    
    event PresaleCreated(
        uint256 indexed _id,
        uint256 _totalTokens,
        uint256 _startTime,
        uint256 _endTime
    );

    event PresaleUpdated(
        bytes32 indexed key,
        uint256 prevValue,
        uint256 newValue,
        uint256 timestamp
    );

    event TokensBought(
        address indexed user,
        uint256 indexed id,
        address indexed purchaseToken,
        uint256 tokensBought,
        uint256 amountPaid,
        uint256 timestamp
    );

    event TokensClaimed(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 timestamp
    );

    event PresaleTokenAddressUpdated(
        address indexed prevValue,
        address indexed newValue,
        uint256 timestamp
    );

    event PresalePaused(uint256 indexed id, uint256 timestamp);
    event PresaleUnpaused(uint256 indexed id, uint256 timestamp);
    
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
     * @dev Constructor sets up the contract parameters
     * @param _oracle Chainlink oracle for ETH price feed
     * @param _usdt USDT token address
     * @param _SaleToken Sale token address
     * @param _MinTokenTobuy Minimum tokens that can be purchased
     * @param _totalTokenSupply Total token supply (100,000,000,000)
     */
    constructor(
        address _oracle,
        address _usdt,
        address _SaleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) Ownable() {
        require(_oracle != address(0), "Oracle address cannot be zero");
        require(_usdt != address(0), "USDT address cannot be zero");
        require(_SaleToken != address(0), "Sale token address cannot be zero");
        require(_MinTokenTobuy > 0, "Minimum token to buy must be greater than zero");
        require(_totalTokenSupply > 0, "Total supply must be greater than zero");
        
        aggregatorInterface = Aggregator(_oracle);
        SaleToken = _SaleToken;
        MinTokenTobuy = _MinTokenTobuy;
        USDTInterface = IERC20Metadata(_usdt);
        ETH_MULTIPLIER = (10**18);
        USDT_MULTIPLIER =(10**6);
        fundReceiver = msg.sender;
        
        // Store total supply
        totalTokenSupply = _totalTokenSupply;
        
        // Calculate allocations
        presaleTokens = _totalTokenSupply.mul(PRESALE_ALLOCATION_PERCENT).div(PERCENT_DENOMINATOR); // 30% for presale
        maxReferralRewards = _totalTokenSupply.mul(REFERRAL_ALLOCATION_PERCENT).div(PERCENT_DENOMINATOR); // 5% for referrals
        _maxStakingRewards = _totalTokenSupply.mul(STAKING_ALLOCATION_PERCENT).div(PERCENT_DENOMINATOR); // 20% for staking rewards
    }
    
    /**
     * @dev Pre-fund the contract with tokens for presale, referrals, and staking
     * @notice Before calling this function:
     * 1. Deploy the token contract
     * 2. Transfer 55% of total supply to this contract address
     * 3. Call this function to verify and activate the pre-funding
     *
     * This marks the contract as ready for presale with tokens available for:
     * - Direct distribution for non-staking purchases
     * - Immediate staking during purchase (no need to claim first)
     * - Referral reward distribution
     */
    function preFundContract() external onlyOwner {
        require(!isTokenPreFunded, "Contract already pre-funded");
        require(SaleToken != address(0), "Sale token not set");
        
        // Calculate total tokens needed
        uint256 totalRequired = presaleTokens.add(maxReferralRewards).add(_maxStakingRewards);
        
        // Check contract balance
        uint256 contractBalance = IERC20(SaleToken).balanceOf(address(this));
        require(contractBalance >= totalRequired, "Insufficient token balance");
        
        // Set pre-funded flag
        isTokenPreFunded = true;
        
        emit TokensPreFunded(SaleToken, contractBalance, block.timestamp);
    }

    /**
     * @dev Update the maximum referral rewards (5% of total supply)
     * @param _totalSupply The total token supply to calculate 5% from
     */
    function updateMaxReferralRewards(uint256 _totalSupply) external onlyOwner {
        require(_totalSupply > 0, "Invalid total supply");
        maxReferralRewards = _totalSupply.mul(REFERRAL_ALLOCATION_PERCENT).div(PERCENT_DENOMINATOR);
    }

    /**
     * @dev Change referral reward percentage with timelock protection
     * @param _percentage New percentage (1-20)
     */
    function updateReferralRewardPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage > 0 && _percentage <= MAX_REFERRAL_PERCENTAGE, "Invalid percentage");
        require(block.timestamp >= referralPercentageChangeTimeLock, "Timelock active");
        
        // Set new timelock for future changes
        referralPercentageChangeTimeLock = block.timestamp.add(REFERRAL_CHANGE_TIMELOCK);
        
        uint256 oldPercentage = referralRewardPercentage;
        referralRewardPercentage = _percentage;
        
        emit ReferralPercentageUpdated(oldPercentage, _percentage, block.timestamp);
    }

    /**
     * @dev Records a valid referral relationship
     * @param _referrer Address of the referrer
     */
    function recordReferral(address _referrer) internal {
        // Security checks
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(!hasUsedReferral[msg.sender], "Already used a referral");
        require(hasQualifiedPurchase[_referrer], "Referrer has not qualified");
        
        // Record the referral relationship
        referralData[msg.sender].referrer = _referrer;
        hasUsedReferral[msg.sender] = true;
        
        // Update referrer stats
        referralData[_referrer].hasReferred = true;
        referralData[_referrer].referralCount++;
        
        emit ReferralRecorded(_referrer, msg.sender, block.timestamp);
    }

    /**
     * @dev Process referral rewards after a successful purchase
     * @param _user Address of the user who made a purchase
     * @param _tokenAmount Amount of tokens purchased
     */
    function processReferralRewards(address _user, uint256 _tokenAmount) internal {
        // Check if purchase meets minimum for referral qualification
        if (_tokenAmount >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            hasQualifiedPurchase[_user] = true;
        }
        
        // If user has a referrer, calculate and assign rewards
        address referrer = referralData[_user].referrer;
        if (referrer != address(0) && _tokenAmount >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            // Calculate rewards (both get the same percentage)
            uint256 referrerReward = _tokenAmount.mul(referralRewardPercentage).div(REFERRAL_DENOMINATOR);
            uint256 refereeReward = referrerReward; // Same reward for both parties
            
            // Check against the max referral rewards cap
            uint256 totalNewRewards = referrerReward.add(refereeReward);
            if (totalReferralRewardsIssued.add(totalNewRewards) <= maxReferralRewards) {
                // Update referrer's rewards
                referralData[referrer].totalReferralRewards = 
                    referralData[referrer].totalReferralRewards.add(referrerReward);
                
                // Update referee's rewards
                referralData[_user].totalReferralRewards = 
                    referralData[_user].totalReferralRewards.add(refereeReward);
                
                // Update total rewards issued
                totalReferralRewardsIssued = totalReferralRewardsIssued.add(totalNewRewards);
                
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
        ReferralData memory data = referralData[_user];
        return data.totalReferralRewards.sub(data.claimedReferralRewards);
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
            referralData[msg.sender].claimedReferralRewards.add(amount);
        
        // Transfer tokens
        bool success = IERC20(SaleToken).transfer(msg.sender, amount);
        require(success, "Token transfer failed");
        
        emit ReferralRewardsClaimed(msg.sender, amount, block.timestamp);
        return true;
    }

    // Utility function to check if an address is a contract
    function isContract(address _addr) internal view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function ChangeTokenToSell(address _token) public onlyOwner {
        SaleToken = _token;
    }

    function EditMinTokenToBuy(uint256 _amount) public onlyOwner {
        MinTokenTobuy = _amount;
    }

    function createPresale(uint256 _price,uint256 _nextStagePrice, uint256 _tokensToSell, uint256 _UsdtHardcap)
        external
        onlyOwner
    {
        require(_price > 0, "Zero price");
        require(_tokensToSell > 0, "Zero tokens to sell");
        require(presale[presaleId].Active == false, "Previous Sale is Active");

        presaleId++;

        presale[presaleId] = Presale(
            0,
            0,
            _price,
            _nextStagePrice,
            0,
            _tokensToSell,
            _UsdtHardcap,
            0,
            false,
            false
        );

        emit PresaleCreated(presaleId, _tokensToSell, 0, 0);
    }

    function startPresale() public onlyOwner {
        presale[presaleId].startTime = block.timestamp;
        presale[presaleId].Active = true;
    }

    function endPresale() public onlyOwner {
        require(
            presale[presaleId].Active = true,
            "This presale is already Inactive"
        );
        presale[presaleId].endTime = block.timestamp;
        presale[presaleId].Active = false;
    }

    // @dev enabel Claim amount
    function enableClaim(uint256 _id, bool _status)
        public
        checkPresaleId(_id)
        onlyOwner
    {
        presale[_id].isEnableClaim = _status;
    }

    function updatePresale(
        uint256 _id,
        uint256 _price,
        uint256 _nextStagePrice,
        uint256 _tokensToSell,
        uint256 _Hardcap
    ) external checkPresaleId(_id) onlyOwner {
        require(_price > 0, "Zero price");
        require(_tokensToSell > 0, "Zero tokens to sell");
        presale[_id].price = _price;
        presale[_id].nextStagePrice = _nextStagePrice;
        presale[_id].tokensToSell = _tokensToSell;
        presale[_id].UsdtHardcap =_Hardcap;
    }

    /**
     * @dev To update the fund receiving wallet
     * @param _wallet address of wallet to update

     */
    function changeFundWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid parameters");
        fundReceiver = _wallet;
    }

    /**
     * @dev To update the USDT Token address
     * @param _newAddress Sale token address
     */
    function changeUSDTToken(address _newAddress) external onlyOwner {
        require(_newAddress != address(0), "Zero token address");
        USDTInterface = IERC20Metadata(_newAddress);
    }

    /**
     * @dev To pause the presale
     * @param _id Presale id to update
     */
    function pausePresale(uint256 _id) external checkPresaleId(_id) onlyOwner {
        require(!paused[_id], "Already paused");
        paused[_id] = true;
        emit PresalePaused(_id, block.timestamp);
    }

    /**
     * @dev To unpause the presale
     * @param _id Presale id to update
     */
    function unPausePresale(uint256 _id)
        external
        checkPresaleId(_id)
        onlyOwner
    {
        require(paused[_id], "Not paused");
        paused[_id] = false;
        emit PresaleUnpaused(_id, block.timestamp);
    }

    /**
     * @dev To get latest ethereum price in 10**18 format
     */
    function getLatestPrice() public view returns (uint256) {
        (, int256 price, , , ) = aggregatorInterface.latestRoundData();
        price = (price * (10**10));
        return uint256(price);
    }

    modifier checkPresaleId(uint256 _id) {
        require(_id > 0 && _id <= presaleId, "Invalid presale id");
        _;
    }

    modifier checkSaleState(uint256 _id, uint256 amount) {
        require(
            block.timestamp >= presale[_id].startTime &&
                presale[_id].Active == true,
            "Invalid time for buying"
        );
        require(
            amount > 0 && amount <= presale[_id].tokensToSell-presale[_id].Sold,
            "Invalid sale amount"
        );
        _;
    }

    function ExcludeAccouctFromMinBuy(address _user, bool _status)
        external
        onlyOwner
    {
        isExcludeMinToken[_user] = _status;
    }

    /**
     * @dev Helper funtion to get ETH price for given amount
     * @param _id Presale id
     * @param amount No of tokens to buy
     */
    function ethBuyHelper(uint256 _id, uint256 amount)
        external
        view
        checkPresaleId(_id)
        returns (uint256 ethAmount)
    {
        uint256 usdPrice = (amount * presale[_id].price);
        ethAmount = (usdPrice * ETH_MULTIPLIER) / (getLatestPrice() * 10**IERC20Metadata(SaleToken).decimals());
    }

    /**
     * @dev Helper funtion to get USDT price for given amount
     * @param _id Presale id
     * @param amount No of tokens to buy
     */
    function usdtBuyHelper(uint256 _id, uint256 amount)
        external
        view
        checkPresaleId(_id)
        returns (uint256 usdPrice)
    {
        usdPrice = (amount * presale[_id].price) / 10**IERC20Metadata(SaleToken).decimals();
    }

    /**
     * @dev Helper funtion to get tokens for eth amount
     * @param _id Presale id
     * @param amount No of eth
     */
    function ethToTokens(uint256 _id, uint256 amount)
        public
        view
        returns (uint256 _tokens)
    {
        uint256 usdAmount = amount * getLatestPrice() * USDT_MULTIPLIER / (ETH_MULTIPLIER * ETH_MULTIPLIER);
        _tokens = usdtToTokens(_id, usdAmount);
    }

    /**
     * @dev Helper funtion to get tokens for given usdt amount
     * @param _id Presale id
     * @param amount No of usdt
     */
    function usdtToTokens(uint256 _id, uint256 amount)
        public
        view
        checkPresaleId(_id)
        returns (uint256 _tokens)
    {
        _tokens = (amount * presale[_id].price) / USDT_MULTIPLIER;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Low balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH Payment failed");
    }

    function unlockToken(uint256 _id)
        public
        view
        checkPresaleId(_id)
        onlyOwner
    {
        require(
            block.timestamp >= presale[_id].endTime,
            "You can only unlock on finalize"
        );
    }

    /**
     * @dev Helper funtion to get claimable tokens for a given presale.
     * @param user User address
     * @param _id Presale id
     */
    function claimableAmount(address user, uint256 _id)
        public
        view
        checkPresaleId(_id)
        returns (uint256)
    {
        ClaimData memory _user = userClaimData[user][_id];

        require(_user.totalAmount > 0, "Nothing to claim");
        uint256 amount = _user.totalAmount - _user.claimedAmount;
        require(amount > 0, "Already claimed");
        return amount;
    }

    /**
     * @dev To claim tokens from a multiple presale
     * @param _id Presale id
     */
    function claimMultiple(uint256[] calldata _id) external returns (bool) {
        require(_id.length > 0, "Zero ID length");
        for (uint256 i; i < _id.length; i++) {
            require(claimAmount(_id[i]), "Claim failed");
        }
        return true;
    }
    
    /**
     * @dev Modified claim function to handle only non-staked tokens
     * @param _id Presale id
     */
    function claimAmount(uint256 _id)
        public 
        virtual
        checkPresaleId(_id)
        returns (bool)
    {
        uint256 amount = claimableAmount(msg.sender, _id);
        
        require(amount > 0, "Zero claim amount");
        require(
            SaleToken != address(0),
            "Presale token address not set"
        );
        require(
            amount <= IERC20(SaleToken).balanceOf(address(this)),
            "Not enough tokens in the contract"
        );

        require((presale[_id].isEnableClaim == true), "Claim is not enable");

        userClaimData[msg.sender][_id].claimAt = block.timestamp;
        userClaimData[msg.sender][_id].claimedAmount += amount;
        
        bool success = IERC20(SaleToken).transfer(msg.sender, amount);
        require(success, "Token transfer failed");
        
        emit TokensClaimed(msg.sender, _id, amount, block.timestamp);
        return true;
    }
    
    // Add functions to get user referral status for the frontend
    function getUserReferralInfo(address _user) external view returns (
        address referrer,
        uint256 totalRewards,
        uint256 claimedRewards,
        uint256 pendingRewards,
        bool isQualifiedReferrer,
        uint256 referralCount
    ) {
        ReferralData memory data = referralData[_user];
        return (
            data.referrer,
            data.totalReferralRewards,
            data.claimedReferralRewards,
            data.totalReferralRewards.sub(data.claimedReferralRewards),
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
            maxReferralRewards.sub(totalReferralRewardsIssued),
            referralPercentageChangeTimeLock
        );
    }

    // Check if a user has a valid referral link to share
    function canReferOthers(address _user) external view returns (bool) {
        return hasQualifiedPurchase[_user];
    }

    function WithdrawTokens(address _token, uint256 amount) external virtual onlyOwner {
        if (_token == SaleToken) {
            // Calculate tokens needed for rewards
            uint256 reservedTokens = totalReferralRewardsIssued;
            
            // Check we're not withdrawing reserved tokens
            uint256 contractBalance = IERC20(_token).balanceOf(address(this));
            require(
                contractBalance.sub(amount) >= reservedTokens,
                "Cannot withdraw tokens reserved for rewards"
            );
        }
        
        IERC20(_token).transfer(fundReceiver, amount);
    }

    function WithdrawContractFunds(uint256 amount) external onlyOwner {
        sendValue(payable(fundReceiver), amount);
    }

    /**
     * Accessor function for maxStakingRewards
     */
    function maxStakingRewards() public view virtual returns (uint256) {
        return _maxStakingRewards;
    }
} 