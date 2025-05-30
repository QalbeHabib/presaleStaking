// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/SaleUtils.sol";
import "./interfaces/ISaleStructs.sol";

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
 */
contract SaleBase is ReentrancyGuard, Ownable, Pausable {
    // State variables
    address public oracle; // Chainlink oracle address
    address public usdt; // USDT token address
    address public SaleToken; // Sale token address
    uint256 public MinTokenTobuy; // Min tokens to buy
    uint256 public TotalUSDTRaised; // Total USDT raised
    uint256 public totalTokenSupply; // Total supply of tokens

    // Presale data
    uint256 public presaleId;
    uint256 public USDT_MULTIPLIER;
    uint256 public ETH_MULTIPLIER;
    address public fundReceiver;
    
    // Total supply and allocations
    uint256 public presaleTokens;
    uint256 public maxReferralRewards;
    uint256 private _maxStakingRewards;

    // Track if the contract has been pre-funded
    bool public isTokenPreFunded = false;

    IERC20Metadata public USDTInterface;
    Aggregator internal aggregatorInterface;

    // Main mappings for presale functionality
    mapping(uint256 => bool) public paused;
    mapping(uint256 => ISaleStructs.Presale) public presale;
    mapping(address => mapping(uint256 => ISaleStructs.ClaimData)) public userClaimData;
    mapping(address => bool) public isExcludeMinToken;
    mapping(address => bool) public isAdmin;
    mapping(address => ISaleStructs.User) public users;

    // Events
    event PresaleStarted(uint256 presaleId, uint256 cap, uint256 price, uint256 startTime, uint256 endTime);
    event PresaleEnded(uint256 presaleId, uint256 endTime);
    event PresalePaused(uint256 indexed id, uint256 timestamp);
    event PresaleUnpaused(uint256 indexed id, uint256 timestamp);
    event OracleUpdated(address previousOracle, address newOracle, uint256 timestamp);
    event TokensPreFunded(address indexed token, uint256 amount, uint256 timestamp);
    event PresaleCreated(uint256 indexed _id, uint256 _totalTokens, uint256 _startTime, uint256 _endTime);
    
    /**
     * @dev Constructor initializes the sale parameters
     */
    constructor(
        address _oracle,
        address _usdt,
        address _SaleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) Ownable(msg.sender) {
        _initialize(_oracle, _usdt, _SaleToken, _MinTokenTobuy, _totalTokenSupply);
    }
    
    /**
     * @dev Internal initialization function
     */
    function _initialize(
        address _oracle,
        address _usdt,
        address _SaleToken,
        uint256 _MinTokenTobuy,
        uint256 _totalTokenSupply
    ) internal {
        require(_oracle != address(0), "Zero oracle");
        require(_usdt != address(0), "Zero USDT");
        require(_SaleToken != address(0), "Zero token");
        require(_MinTokenTobuy > 0, "Zero min");
        require(_totalTokenSupply > 0, "Zero supply");
        
        aggregatorInterface = Aggregator(_oracle);
        SaleToken = _SaleToken;
        MinTokenTobuy = _MinTokenTobuy;
        USDTInterface = IERC20Metadata(_usdt);
        ETH_MULTIPLIER = (10**18);
        USDT_MULTIPLIER = (10**6);
        fundReceiver = msg.sender;
        
        // Store total supply
        totalTokenSupply = _totalTokenSupply;
        
        // Calculate allocations - 30% for presale, 5% for referrals, 20% for staking
        presaleTokens = _totalTokenSupply * 30 / 100;
        maxReferralRewards = _totalTokenSupply * 5 / 100;
        _maxStakingRewards = _totalTokenSupply * 20 / 100;
    }
    
    /**
     * @dev Pre-fund the contract with tokens for presale, referrals, and staking
     */
    function preFundContract() external onlyOwner {
        require(!isTokenPreFunded, "Already funded");
        require(SaleToken != address(0), "Token not set");
        
        // Calculate total tokens needed
        uint256 totalRequired = presaleTokens + maxReferralRewards + _maxStakingRewards;
        
        // Check contract balance
        uint256 contractBalance = IERC20(SaleToken).balanceOf(address(this));
        require(contractBalance >= totalRequired, "Insufficient balance");
        
        // Set pre-funded flag
        isTokenPreFunded = true;
        
        emit TokensPreFunded(SaleToken, contractBalance, block.timestamp);
    }
    
    /**
     * @dev Create a new presale
     */
    function createPresale(
        uint256 _price,
        uint256 _nextStagePrice, 
        uint256 _tokensToSell, 
        uint256 _UsdtHardcap
    ) external onlyOwner {
        require(_price > 0, "Zero price");
        require(_tokensToSell > 0, "Zero tokens");
        require(!presale[presaleId].Active, "Sale active");

        presaleId++;

        presale[presaleId] = ISaleStructs.Presale(
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

    /**
     * @dev Start the presale
     */
    function startPresale() public onlyOwner {
        presale[presaleId].startTime = block.timestamp;
        presale[presaleId].Active = true;
    }

    /**
     * @dev End the presale
     */
    function endPresale() public onlyOwner {
        require(presale[presaleId].Active, "Already inactive");
        presale[presaleId].endTime = block.timestamp;
        presale[presaleId].Active = false;
    }

    /**
     * @dev Enable claiming for a presale
     */
    function enableClaim(uint256 _id, bool _status)
        public
        checkPresaleId(_id)
        onlyOwner
    {
        presale[_id].isEnableClaim = _status;
    }

    /**
     * @dev Update presale parameters
     */
    function updatePresale(
        uint256 _id,
        uint256 _price,
        uint256 _nextStagePrice,
        uint256 _tokensToSell,
        uint256 _Hardcap
    ) external checkPresaleId(_id) onlyOwner {
        require(_price > 0, "Zero price");
        require(_tokensToSell > 0, "Zero tokens");
        presale[_id].price = _price;
        presale[_id].nextStagePrice = _nextStagePrice;
        presale[_id].tokensToSell = _tokensToSell;
        presale[_id].UsdtHardcap = _Hardcap;
    }

    /**
     * @dev Change fund receiving wallet
     */
    function changeFundWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero address");
        fundReceiver = _wallet;
    }

    /**
     * @dev Change USDT token address
     */
    function changeUSDTToken(address _newAddress) external onlyOwner {
        require(_newAddress != address(0), "Zero address");
        USDTInterface = IERC20Metadata(_newAddress);
    }

    /**
     * @dev Update the sale token address
     */
    function ChangeTokentoSell(address _newTokenAddress) external onlyOwner {
        require(_newTokenAddress != address(0), "Zero address");
        SaleToken = _newTokenAddress;
    }

    /**
     * @dev Update minimum token purchase amount
     */
    function EditMinTokenToBuy(uint256 _newMinAmount) external onlyOwner {
        require(_newMinAmount > 0, "Zero min");
        MinTokenTobuy = _newMinAmount;
    }

    /**
     * @dev Pause a presale
     */
    function pausePresale(uint256 _id) external checkPresaleId(_id) onlyOwner {
        require(!paused[_id], "Already paused");
        paused[_id] = true;
        emit PresalePaused(_id, block.timestamp);
    }

    /**
     * @dev Unpause a presale
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
     * @dev Get the latest ETH price from Chainlink
     */
    function getLatestPrice() public view returns (uint256) {
        (, int256 price, , , ) = aggregatorInterface.latestRoundData();
        price = (price * (10**10));
        return uint256(price);
    }

    /**
     * @dev Helper funtion to get tokens for eth amount
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
     */
    function usdtToTokens(uint256 _id, uint256 amount)
        public
        view
        checkPresaleId(_id)
        returns (uint256 _tokens)
    {
        _tokens = (amount * (10**18)) / presale[_id].price;
    }

    /**
     * @dev Helper funtion to get ETH price for given amount
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
     * @dev Helper funtion to get claimable tokens for a given presale
     */
    function claimableAmount(address user, uint256 _id)
        public
        view
        checkPresaleId(_id)
        returns (uint256)
    {
        ISaleStructs.ClaimData memory _user = userClaimData[user][_id];

        require(_user.totalAmount > 0, "Nothing to claim");
        uint256 amount = _user.totalAmount - _user.claimedAmount;
        require(amount > 0, "Already claimed");
        return amount;
    }

    /**
     * @dev Exclude account from minimum buy requirement
     */
    function ExcludeAccouctFromMinBuy(address _user, bool _status)
        external
        onlyOwner
    {
        isExcludeMinToken[_user] = _status;
    }
    
    /**
     * @dev Public getter for max staking rewards
     */
    function maxStakingRewards() public view virtual returns (uint256) {
        return _maxStakingRewards;
    }

    /**
     * @dev Calculate reserved tokens at the base level
     * This will be overridden by derived contracts to include additional reservations
     */
    function calculateBaseReservedTokens() public view virtual returns (uint256) {
        // At the base level, no tokens are reserved
        return 0;
    }

    /**
     * @dev Withdraw all available tokens from contract after accounting for reserved tokens
     */
    function WithdrawAllTokens(address _token) external virtual onlyOwner {
        if (_token == SaleToken) {
            // Calculate reserved tokens (will be overridden in child contracts)
            uint256 reservedTokens = calculateBaseReservedTokens();
            
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
     * @dev Withdraw all ETH balance from contract
     */
    function WithdrawAllContractFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH balance to withdraw");
        SaleUtils.sendValue(payable(fundReceiver), balance);
    }



    /**
     * @dev Modifier to check presale ID validity
     */
    modifier checkPresaleId(uint256 _id) {
        require(_id > 0 && _id <= presaleId, "Invalid ID");
        _;
    }

    /**
     * @dev Modifier to check sale state
     */
    modifier checkSaleState(uint256 _id, uint256 amount) {
        require(block.timestamp >= presale[_id].startTime && presale[_id].Active, "Invalid time");
        require(amount > 0 && amount <= presale[_id].tokensToSell-presale[_id].Sold, "Invalid amount");
        _;
    }
} 