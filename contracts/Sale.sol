// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./StakingManager.sol";
import "./libraries/SaleUtils.sol";
import "./interfaces/ISaleStructs.sol";

/**
 * @title PreSale and Staking Contract
 * @notice This contract handles token presale, referral rewards, and staking functionality
 * @dev All tokens (presale, referral, staking) must be sent to the contract before starting
 *
 * Token Allocation:
 * - 30% for presale (30,000,000,000 tokens)
 * - 5% for referral rewards (5,000,000,000 tokens)
 * - 20% for staking rewards (20,000,000,000 tokens)
 *
 * Total: 55% of total supply must be transferred to this contract
 */
contract Sale is StakingManager {
    // Events
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
    ) 
      StakingManager(_oracle, _usdt, _SaleToken, _MinTokenTobuy, _totalTokenSupply)
    {}

    /**
     * @dev Buy into a presale using USDT with option for immediate staking
     */
    function buyWithUSDT(
        uint256 usdAmount, 
        address referrer, 
        bool shouldStake
    ) external
        checkPresaleId(presaleId)
        checkSaleState(presaleId, usdtToTokens(presaleId, usdAmount))
        nonReentrant
        returns (bool)
    {
        require(isTokenPreFunded, "Not pre-funded");
        require(!paused[presaleId], "Presale paused");
        require(presale[presaleId].Active, "Inactive presale");
        require(presale[presaleId].amountRaised + usdAmount <= presale[presaleId].UsdtHardcap, "Hardcap limit");

        // Handle referral if provided and not zero address
        if (referrer != address(0)) {
            require(!SaleUtils.isContract(referrer), "Contract referrer");
            recordReferral(referrer);
        }

        uint256 tokens = usdtToTokens(presaleId, usdAmount);
        presale[presaleId].Sold += tokens;
        presale[presaleId].amountRaised += usdAmount;
        TotalUSDTRaised += usdAmount; 

        if (!isExcludeMinToken[msg.sender]) {
            require(tokens >= MinTokenTobuy, "Min amount not met");
        }

        uint256 ourAllowance = USDTInterface.allowance(_msgSender(), address(this));
        require(usdAmount <= ourAllowance, "Insufficient allowance");
        
        (bool success, ) = address(USDTInterface).call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                _msgSender(),
                fundReceiver,
                usdAmount
            )
        );
        require(success, "USDT transfer failed");
        
        // Update users mapping with purchase data
        _updateUserData(tokens, usdAmount, referrer);
        
        // Handle tokens based on staking preference
        _handleTokensAfterPurchase(tokens, shouldStake);
        
        emit TokensBought(
            _msgSender(),
            presaleId,
            address(USDTInterface),
            tokens,
            usdAmount,
            block.timestamp
        );
        
        return true;
    }

    /**
     * @dev Buy into a presale using ETH with option for immediate staking
     */
    function buyWithEth(
        address referrer, 
        bool shouldStake
    ) external
        payable
        checkPresaleId(presaleId)
        checkSaleState(presaleId, ethToTokens(presaleId, msg.value))
        nonReentrant
        returns (bool)
    {
        require(isTokenPreFunded, "Not pre-funded");
        uint256 usdAmount = (msg.value * getLatestPrice() * USDT_MULTIPLIER) / (ETH_MULTIPLIER * ETH_MULTIPLIER);
        require(presale[presaleId].amountRaised + usdAmount <= presale[presaleId].UsdtHardcap, "Hardcap limit");

        require(!paused[presaleId], "Presale paused");
        require(presale[presaleId].Active, "Inactive presale");
        
        // Handle referral if provided
        if (referrer != address(0)) {
            require(!SaleUtils.isContract(referrer), "Contract referrer");
            recordReferral(referrer);
        }

        uint256 tokens = usdtToTokens(presaleId, usdAmount);
        if (!isExcludeMinToken[msg.sender]) {
            require(tokens >= MinTokenTobuy, "Min amount not met");
        }
        
        presale[presaleId].Sold += tokens;
        presale[presaleId].amountRaised += usdAmount;
        TotalUSDTRaised += usdAmount;

        // Update user data and handle tokens
        _updateUserData(tokens, usdAmount, referrer);
        _handleTokensAfterPurchase(tokens, shouldStake);

        SaleUtils.sendValue(payable(fundReceiver), msg.value);
        
        emit TokensBought(
            _msgSender(),
            presaleId,
            address(0),
            tokens,
            msg.value,
            block.timestamp
        );
        
        return true;
    }
    
    /**
     * @dev Update user data after purchase
     */
    function _updateUserData(uint256 tokens, uint256 usdAmount, address referrer) private {
        users[_msgSender()].TotalBoughtTokens += tokens;
        users[_msgSender()].TotalPaid += usdAmount;
        
        // Users who buy enough tokens qualify as referrers, regardless of whether they used a referrer themselves
        // This allows users to build their own referral chains even if they entered the system without a referrer
        if (tokens >= MINIMUM_PURCHASE_FOR_REFERRAL) {
            hasQualifiedPurchase[_msgSender()] = true;
        }
        
        // Process referral rewards only if a referrer was provided
        if (referrer != address(0)) {
            processReferralRewards(_msgSender(), tokens);
        }
    }
    
    /**
     * @dev Handle tokens after purchase based on staking preference
     */
    function _handleTokensAfterPurchase(uint256 tokens, bool shouldStake) private {
        if (shouldStake) {
            _handleTokenStaking(_msgSender(), tokens);
        } else {
            if (userClaimData[_msgSender()][presaleId].totalAmount > 0) {
                userClaimData[_msgSender()][presaleId].totalAmount += tokens;
            } else {
                userClaimData[_msgSender()][presaleId] = ISaleStructs.ClaimData(0, tokens, 0);
            }
        }
    }
    
    /**
     * @dev Claim function to handle only non-staked tokens
     */
    function claimAmount(uint256 _id)
        public
        checkPresaleId(_id)
        returns (bool)
    {
        uint256 amount = claimableAmount(msg.sender, _id);
        
        require(amount > 0, "Nothing to claim");
        require(SaleToken != address(0), "Token not set");
        require(amount <= IERC20(SaleToken).balanceOf(address(this)), "Insufficient funds");
        require(presale[_id].isEnableClaim, "Claiming disabled");

        userClaimData[msg.sender][_id].claimAt = block.timestamp;
        userClaimData[msg.sender][_id].claimedAmount += amount;
        
        // Process based on staking intent
        if (userStakingIntent[msg.sender]) {
            _handleTokenStaking(msg.sender, amount);
            userStakingIntent[msg.sender] = false;
        } else {
            bool success = IERC20(SaleToken).transfer(msg.sender, amount);
            require(success, "Transfer failed");
        }
        
        emit TokensClaimedWithTimestamp(msg.sender, _id, amount, block.timestamp);
        return true;
    }

    /**
     * @dev To claim tokens from multiple presales
     */
    function claimMultiple(uint256[] calldata _ids) external returns (bool) {
        require(_ids.length > 0, "Empty array");
        for (uint256 i; i < _ids.length; i++) {
            require(claimAmount(_ids[i]), "Claim failed");
        }
        return true;
    }
} 