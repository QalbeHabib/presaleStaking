// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// Import our custom contracts
import "./SaleBase.sol";
import "./StakingManager.sol";

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
    {
        // No additional initialization needed
    }

    /**
     * @dev To buy into a presale using USDT with option for immediate staking
     * @param usdAmount USDT amount to buy tokens
     * @param referrer Referrer address (optional, use address(0) for no referrer)
     * @param shouldStake If true, tokens are immediately staked for 1 year with 200% APY
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
        require(isTokenPreFunded, "Contract not pre-funded with tokens");
        require(!paused[presaleId], "Presale paused");
        require(presale[presaleId].Active == true, "Presale is not active yet");
        require(presale[presaleId].amountRaised + usdAmount <= presale[presaleId].UsdtHardcap,
        "Amount should be less than leftHardcap");

        // Handle referral if provided and not zero address
        if (referrer != address(0)) {
            // Security check to prevent contract-based referrals (potential attack vector)
            require(!isContract(referrer), "Referrer cannot be a contract");
            recordReferral(referrer);
        }

        uint256 tokens = usdtToTokens(presaleId, usdAmount);
        presale[presaleId].Sold += tokens;
        presale[presaleId].amountRaised += usdAmount;
        TotalUSDTRaised += usdAmount; // Update total USDT raised

        if (isExcludeMinToken[msg.sender] == false) {
            require(tokens >= MinTokenTobuy, "Less than min amount");
        }

        uint256 ourAllowance = USDTInterface.allowance(
            _msgSender(),
            address(this)
        );
        require(usdAmount <= ourAllowance, "Make sure to add enough allowance");
        (bool success, ) = address(USDTInterface).call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                _msgSender(),
                fundReceiver,
                usdAmount
            )
        );
        require(success, "Token payment failed");
        
        // Update users mapping with purchase data
        users[_msgSender()].TotalBoughtTokens += tokens;
        users[_msgSender()].TotalPaid += usdAmount;
        users[_msgSender()].lastClaimTime = block.timestamp;
        
        // If referrer is valid, update referral relationship
        if (referrer != address(0)) {
            users[_msgSender()].referrer = referrer;
            
            // Add user to referrer's referredUsers array if not already there
            bool alreadyReferred = false;
            for (uint i = 0; i < users[referrer].referredUsers.length; i++) {
                if (users[referrer].referredUsers[i] == _msgSender()) {
                    alreadyReferred = true;
                    break;
                }
            }
            if (!alreadyReferred) {
                users[referrer].referredUsers.push(_msgSender());
            }
            
            // Process referral rewards
            processReferralRewards(_msgSender(), tokens);
        }
        
        // Handle tokens based on staking preference
        if (shouldStake) {
            // Directly stake tokens since the contract is pre-funded
            _handleTokenStaking(_msgSender(), tokens);
        } else {
            // Record for later claiming
            if (userClaimData[_msgSender()][presaleId].totalAmount > 0) {
                userClaimData[_msgSender()][presaleId].totalAmount += tokens;
            } else {
                userClaimData[_msgSender()][presaleId] = ClaimData(0, tokens, 0);
            }
        }
        
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
     * @dev To buy into a presale using ETH with option for immediate staking
     * @param referrer Referrer address (optional, use address(0) for no referrer)
     * @param shouldStake If true, tokens are immediately staked for 1 year with 200% APY
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
        require(isTokenPreFunded, "Contract not pre-funded with tokens");
        uint256 usdAmount = (msg.value * getLatestPrice() * USDT_MULTIPLIER) / (ETH_MULTIPLIER * ETH_MULTIPLIER);
        require(presale[presaleId].amountRaised + usdAmount <= presale[presaleId].UsdtHardcap,
        "Amount should be less than leftHardcap");

        require(!paused[presaleId], "Presale paused");
        require(presale[presaleId].Active == true, "Presale is not active yet");
        
        // Handle referral if provided and not zero address
        if (referrer != address(0)) {
            // Security check to prevent contract-based referrals
            require(!isContract(referrer), "Referrer cannot be a contract");
            recordReferral(referrer);
        }

        uint256 tokens = usdtToTokens(presaleId, usdAmount);
        if (isExcludeMinToken[msg.sender] == false) {
            require(tokens >= MinTokenTobuy, "Insufficient amount!");
        }
        presale[presaleId].Sold += tokens;
        presale[presaleId].amountRaised += usdAmount;
        TotalUSDTRaised += usdAmount; // Update total USDT raised

        // Update users mapping with purchase data
        users[_msgSender()].TotalBoughtTokens += tokens;
        users[_msgSender()].TotalPaid += usdAmount;
        users[_msgSender()].lastClaimTime = block.timestamp;
        
        // If referrer is valid, update referral relationship
        if (referrer != address(0)) {
            users[_msgSender()].referrer = referrer;
            
            // Add user to referrer's referredUsers array if not already there
            bool alreadyReferred = false;
            for (uint i = 0; i < users[referrer].referredUsers.length; i++) {
                if (users[referrer].referredUsers[i] == _msgSender()) {
                    alreadyReferred = true;
                    break;
                }
            }
            if (!alreadyReferred) {
                users[referrer].referredUsers.push(_msgSender());
            }
            
            // Process referral rewards
            processReferralRewards(_msgSender(), tokens);
        }

        // Handle tokens based on staking preference
        if (shouldStake) {
            // Directly stake tokens since the contract is pre-funded
            _handleTokenStaking(_msgSender(), tokens);
        } else {
            // Record for later claiming
            if (userClaimData[_msgSender()][presaleId].totalAmount > 0) {
                userClaimData[_msgSender()][presaleId].totalAmount += tokens;
            } else {
                userClaimData[_msgSender()][presaleId] = ClaimData(
                    0, // Last claimed at
                    tokens, // total tokens to be claimed
                    0 // claimed amount
                );
            }
        }

        sendValue(payable(fundReceiver), msg.value);
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
     * @dev Modified claim function to handle only non-staked tokens
     * @param _id Presale id
     */
    function claimAmount(uint256 _id)
        public
        override
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
        
        // Check if the user has set staking intent
        if (userStakingIntent[msg.sender]) {
            // Stake all tokens directly
            _handleTokenStaking(msg.sender, amount);
            
            // Reset staking intent after processing
            userStakingIntent[msg.sender] = false;
        } else {
            // Normal token transfer for non-staking users
            bool success = IERC20(SaleToken).transfer(msg.sender, amount);
            require(success, "Token transfer failed");
        }
        
        emit TokensClaimedWithTimestamp(msg.sender, _id, amount, block.timestamp);
        return true;
    }

    function WithdrawTokens(address _token, uint256 amount) external override onlyOwner {
        if (_token == SaleToken) {
            // Calculate tokens needed for rewards and stakes
            uint256 reservedTokens = totalReferralRewardsIssued +
                // Staked tokens plus their potential rewards
                totalStaked * (STAKING_APY + 100) / PERCENT_DENOMINATOR;
            
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
}