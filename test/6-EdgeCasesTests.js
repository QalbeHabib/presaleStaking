const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Edge Cases and Limits Tests", function() {
  // Increase timeout for testing
  this.timeout(50000);
  
  let sale, saleToken, usdt, priceFeed;
  let owner, buyer1, buyer2, referrer;
  let presaleId, totalTokenSupply;
  
  beforeEach(async function() {
    // Deploy the full test environment
    const deployment = await deploySaleContract();
    sale = deployment.sale;
    saleToken = deployment.saleToken;
    usdt = deployment.usdt;
    priceFeed = deployment.priceFeed;
    owner = deployment.owner;
    buyer1 = deployment.buyer1;
    buyer2 = deployment.buyer2;
    referrer = deployment.referrer;
    presaleId = deployment.presaleId;
    totalTokenSupply = deployment.totalTokenSupply;
  });
  
  describe("Token Limits and Hardcap", function() {
    it("should enforce minimum token purchase", async function() {
      // Get minimum tokens amount
      const minTokensToBuy = await sale.MinTokenTobuy();
      
      // Get presale price
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      
      // Calculate USDT needed for minimum purchase
      const usdtNeeded = minTokensToBuy.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Try to buy just below the minimum
      const belowMinAmount = usdtNeeded.sub(1);
      await usdt.connect(buyer1).approve(sale.address, belowMinAmount);
      
      // Should revert with minimum amount error
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          belowMinAmount,
          ethers.constants.AddressZero,
          false
        )
      ).to.be.revertedWith("Min amount not met");
      
      // Now try with exactly the minimum
      await usdt.connect(buyer1).approve(sale.address, usdtNeeded);
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          usdtNeeded,
          ethers.constants.AddressZero,
          false
        )
      ).to.not.be.reverted;
    });
    
    it("should enforce token sale hardcap", async function() {
      // Get presale hardcap
      const presale = await sale.presale(presaleId);
      const hardcap = presale.UsdtHardcap;
      
      // Try to buy exactly at hardcap
      await usdt.connect(buyer1).approve(sale.address, hardcap);
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          hardcap,
          ethers.constants.AddressZero,
          false
        )
      ).to.not.be.reverted;
      
      // Try to buy even 1 more token (should fail)
      const smallAmount = ethers.utils.parseUnits("1", 6); // Just 1 USDT
      await usdt.connect(buyer2).approve(sale.address, smallAmount);
      
      // Should revert with hardcap limit error
      await expect(
        sale.connect(buyer2).buyWithUSDT(
          smallAmount,
          ethers.constants.AddressZero,
          false
        )
      ).to.be.revertedWith("Hardcap limit");
    });
    
    it("should enforce tokens to sell limit", async function() {
      // Get presale
      const presale = await sale.presale(presaleId);
      
      // Calculate USDT needed to buy all tokens exactly
      const allTokens = presale.tokensToSell;
      const tokenPrice = presale.price;
      
      // USDT needed = (tokens * price) / 10^18
      const usdtNeeded = allTokens.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Ensure this doesn't exceed hardcap
      expect(usdtNeeded).to.be.lte(presale.UsdtHardcap);
      
      // Buy all tokens
      await usdt.connect(buyer1).approve(sale.address, usdtNeeded);
      await sale.connect(buyer1).buyWithUSDT(
        usdtNeeded,
        ethers.constants.AddressZero,
        false
      );
      
      // Try to buy even 1 more token (should fail)
      const smallAmount = ethers.utils.parseUnits("1", 6); // Just 1 USDT
      await usdt.connect(buyer2).approve(sale.address, smallAmount);
      
      // Should revert with tokens sold out error
      await expect(
        sale.connect(buyer2).buyWithUSDT(
          smallAmount,
          ethers.constants.AddressZero,
          false
        )
      ).to.be.revertedWith("Tokens sold out");
    });
  });
  
  describe("Staking Edge Cases", function() {
    it("should calculate rewards correctly for odd staking periods", async function() {
      // Buy tokens with ETH and stake
      const ethAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        true, // Stake tokens
        { value: ethAmount }
      );
      
      // Get original stake amount
      const stakeInfo = await sale.userStakes(buyer1.address);
      const stakedAmount = stakeInfo.stakedAmount;
      
      // Fast forward time to exactly 365 days (edge case)
      const stakingTimestamp = stakeInfo.stakingTimestamp.toNumber();
      const unlockTime = stakingTimestamp + 365 * 24 * 60 * 60;
      await time.increaseTo(unlockTime);
      
      // Try to withdraw - should succeed as it's exactly at unlock time
      await expect(
        sale.connect(buyer1).withdrawStake()
      ).to.not.be.reverted;
      
      // Verify correct reward amount (200% APY)
      const initialBalance = ethers.constants.Zero;
      const finalBalance = await saleToken.balanceOf(buyer1.address);
      
      const expectedReward = stakedAmount.mul(200).div(100);
      const expectedTotal = stakedAmount.add(expectedReward);
      
      expect(finalBalance.sub(initialBalance)).to.equal(expectedTotal);
    });
    
    it("should handle multiple stakes from same user correctly", async function() {
      // Buy and stake first batch
      const ethAmount1 = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        true, // Stake tokens
        { value: ethAmount1 }
      );
      
      // Get first stake data
      const stakeInfo1 = await sale.userStakes(buyer1.address);
      const stakedAmount1 = stakeInfo1.stakedAmount;
      
      // Try to stake more (should fail as user already has a stake)
      const ethAmount2 = ethers.utils.parseEther("0.3");
      
      // Should revert with already staked error
      await expect(
        sale.connect(buyer1).buyWithEth(
          ethers.constants.AddressZero,
          true, // Try to stake again
          { value: ethAmount2 }
        )
      ).to.be.revertedWith("User already staked");
      
      // Buy without staking should still work
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        false, // Don't stake
        { value: ethAmount2 }
      );
      
      // Verify stake amount didn't change
      const stakeInfo2 = await sale.userStakes(buyer1.address);
      expect(stakeInfo2.stakedAmount).to.equal(stakedAmount1);
    });
    
    it("should prevent withdrawal after stake has been withdrawn", async function() {
      // Buy tokens with ETH and stake
      const ethAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        true, // Stake tokens
        { value: ethAmount }
      );
      
      // Fast forward time past unlock period
      await time.increase(366 * 24 * 60 * 60);
      
      // First withdrawal should succeed
      await sale.connect(buyer1).withdrawStake();
      
      // Check that stake is marked as withdrawn
      const stakeInfo = await sale.userStakes(buyer1.address);
      expect(stakeInfo.hasWithdrawn).to.be.true;
      
      // Try to withdraw again (should fail)
      await expect(
        sale.connect(buyer1).withdrawStake()
      ).to.be.revertedWith("Stake already withdrawn");
    });
  });
  
  describe("Referral Edge Cases", function() {
    it("should handle complex referral chains correctly", async function() {
      // Initial configuration: make all accounts qualify as referrers
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Qualify all accounts
      for (const account of [referrer, buyer1, buyer2]) {
        await usdt.connect(account).approve(sale.address, usdtNeeded);
        await sale.connect(account).buyWithUSDT(
          usdtNeeded,
          ethers.constants.AddressZero,
          false
        );
      }
      
      // Create a referral chain: referrer -> buyer1 -> buyer2
      // First, buyer1 buys using referrer
      const usdtAmount1 = ethers.utils.parseUnits("500", 6);
      await usdt.connect(buyer1).approve(sale.address, usdtAmount1);
      await sale.connect(buyer1).buyWithUSDT(
        referrer.address, // Use referrer
        false,
        usdtAmount1
      );
      
      // Now buyer2 tries to use buyer1
      const usdtAmount2 = ethers.utils.parseUnits("500", 6);
      await usdt.connect(buyer2).approve(sale.address, usdtAmount2);
      await sale.connect(buyer2).buyWithUSDT(
        buyer1.address, // Use buyer1 as referrer
        false,
        usdtAmount2
      );
      
      // Verify correct referral relationships
      const referrer1Data = await sale.referralData(buyer1.address);
      const referrer2Data = await sale.referralData(buyer2.address);
      
      expect(referrer1Data.referrer).to.equal(referrer.address);
      expect(referrer2Data.referrer).to.equal(buyer1.address);
      
      // Verify all have appropriate rewards
      expect(referrer1Data.totalReferralRewards).to.be.gt(0);
      expect(referrer2Data.totalReferralRewards).to.be.gt(0);
      
      const referrerData = await sale.referralData(referrer.address);
      expect(referrerData.totalReferralRewards).to.be.gt(0);
    });
    
    it("should prevent qualifying as referrer without minimum purchase", async function() {
      // Create a fresh account that hasn't made any purchases
      const [, , , , newAccount] = await ethers.getSigners();
      
      // Try to use this account as a referrer
      const ethAmount = ethers.utils.parseEther("0.5");
      
      // Should revert with unqualified referrer error
      await expect(
        sale.connect(buyer1).buyWithEth(
          newAccount.address, // Try to use unqualified referrer
          false,
          { value: ethAmount }
        )
      ).to.be.revertedWith("Unqualified referrer");
      
      // Make minimal purchase (but below referral qualification)
      const minTokensToBuy = await sale.MinTokenTobuy();
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      const usdtNeeded = minTokensToBuy.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Get minimum for referral qualification
      const minForReferral = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const usdtForReferral = minForReferral.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Ensure our test amount is valid (above min purchase but below referral qualification)
      const testAmount = usdtNeeded.mul(2); // Double minimum purchase
      expect(testAmount).to.be.lt(usdtForReferral);
      
      // Make purchase just below referral qualification
      await usdt.mint(newAccount.address, testAmount);
      await usdt.connect(newAccount).approve(sale.address, testAmount);
      await sale.connect(newAccount).buyWithUSDT(
        ethers.constants.AddressZero,
        false,
        testAmount
      );
      
      // Try to use as referrer again (should still fail)
      await expect(
        sale.connect(buyer1).buyWithEth(
          newAccount.address, // Try to use still unqualified referrer
          false,
          { value: ethAmount }
        )
      ).to.be.revertedWith("Unqualified referrer");
    });
  });
  
  describe("Contract Function Usage Scenarios", function() {
    it("should handle repeated token claims", async function() {
      // Buy tokens
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        ethers.constants.AddressZero,
        false, // Don't stake
        usdtAmount
      );
      
      // Get claim data
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(claimData.totalAmount).to.be.gt(0);
      expect(claimData.remainingAmount).to.equal(claimData.totalAmount);
      
      // Claim tokens first time
      await sale.connect(buyer1).claimTokens(presaleId);
      
      // Verify tokens were claimed
      const updatedClaimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(updatedClaimData.remainingAmount).to.equal(0);
      
      // Try to claim again (should succeed but do nothing)
      await expect(
        sale.connect(buyer1).claimTokens(presaleId)
      ).to.not.be.reverted;
      
      // Claim status should remain the same
      const finalClaimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(finalClaimData.remainingAmount).to.equal(0);
    });
    
    it("should handle zero ETH value calls gracefully", async function() {
      // Try to buy with zero ETH
      await expect(
        sale.connect(buyer1).buyWithEth(
          ethers.constants.AddressZero,
          false,
          { value: 0 }
        )
      ).to.be.revertedWith("Min amount not met");
    });
    
    it("should handle token price changes mid-sale", async function() {
      // Buy tokens at initial price
      const presale = await sale.presale(presaleId);
      const initialPrice = presale.price;
      
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        ethers.constants.AddressZero,
        false,
        usdtAmount
      );
      
      // Record tokens bought at initial price
      const initialClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const tokensBoughtAtInitialPrice = initialClaimData.totalAmount;
      
      // Change price (double it)
      const newPrice = initialPrice.mul(2);
      await sale.connect(owner).updatePrice(newPrice);
      
      // Buy same USDT amount at new price
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        ethers.constants.AddressZero,
        false,
        usdtAmount
      );
      
      // Get updated claim data
      const updatedClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const totalTokensBought = updatedClaimData.totalAmount;
      const tokensBoughtAtNewPrice = totalTokensBought.sub(tokensBoughtAtInitialPrice);
      
      // With double the price, should get half the tokens for same USDT
      // Allow small rounding differences
      const halfInitialTokens = tokensBoughtAtInitialPrice.div(2);
      const lowerBound = halfInitialTokens.mul(98).div(100); // 98% of expected amount
      const upperBound = halfInitialTokens.mul(102).div(100); // 102% of expected amount
      
      expect(tokensBoughtAtNewPrice).to.be.gte(lowerBound);
      expect(tokensBoughtAtNewPrice).to.be.lte(upperBound);
    });
  });
  
  describe("Contract Interactions", function() {
    it("should handle ETH price feed changes correctly", async function() {
      // Get initial ETH price
      const initialPriceData = await priceFeed.latestRoundData();
      const initialEthPrice = initialPriceData[1];
      
      // Buy tokens with ETH at current price
      const ethAmount = ethers.utils.parseEther("1");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        false,
        { value: ethAmount }
      );
      
      // Record tokens bought at initial ETH price
      const initialClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const tokensBoughtAtInitialPrice = initialClaimData.totalAmount;
      
      // Change ETH price (half it) - this means ETH is worth less now
      const newEthPrice = initialEthPrice.div(2);
      await priceFeed.setLatestAnswer(newEthPrice);
      
      // Buy with same ETH amount at new price
      await sale.connect(buyer2).buyWithEth(
        ethers.constants.AddressZero,
        false,
        { value: ethAmount }
      );
      
      // Get buyer2's claim data
      const newPriceClaimData = await sale.userClaimData(buyer2.address, presaleId);
      const tokensBoughtAtNewPrice = newPriceClaimData.totalAmount;
      
      // With half the ETH price, should get half the tokens for same ETH
      // Allow small rounding differences
      const halfInitialTokens = tokensBoughtAtInitialPrice.div(2);
      const lowerBound = halfInitialTokens.mul(98).div(100); // 98% of expected amount
      const upperBound = halfInitialTokens.mul(102).div(100); // 102% of expected amount
      
      expect(tokensBoughtAtNewPrice).to.be.gte(lowerBound);
      expect(tokensBoughtAtNewPrice).to.be.lte(upperBound);
    });
    
    it("should handle contract pre-funding correctly", async function() {
      // Deploy a new contract
      const Sale = await ethers.getContractFactory("Sale");
      const priceFeedAddress = priceFeed.address;
      const usdtAddress = usdt.address;
      const saleTokenAddress = saleToken.address;
      const minTokensToBuy = ethers.utils.parseEther("100");
      const newTotalSupply = ethers.utils.parseEther("100000000000");
      
      const newSale = await Sale.deploy(
        priceFeedAddress,
        usdtAddress,
        saleTokenAddress,
        minTokensToBuy,
        newTotalSupply
      );
      await newSale.deployed();
      
      // Try to create presale before pre-funding (should fail)
      const price = ethers.utils.parseUnits("0.01", 6);
      const nextStagePrice = ethers.utils.parseUnits("0.015", 6);
      const tokensToSell = newTotalSupply.mul(30).div(100); // 30% for presale
      const usdtHardcap = ethers.utils.parseUnits("300000", 6);
      
      await expect(
        newSale.createPresale(price, nextStagePrice, tokensToSell, usdtHardcap)
      ).to.be.revertedWith("Fund contract first");
      
      // Pre-fund the contract with tokens
      const presaleTokens = newTotalSupply.mul(30).div(100); // 30% for presale
      const referralRewards = newTotalSupply.mul(5).div(100); // 5% for referrals
      const stakingRewards = newTotalSupply.mul(20).div(100); // 20% for staking
      const totalFunding = presaleTokens.add(referralRewards).add(stakingRewards);
      
      // Approve and transfer tokens to the contract
      await saleToken.approve(newSale.address, totalFunding);
      await saleToken.transfer(newSale.address, totalFunding);
      
      // Now pre-fund
      await newSale.preFundContract();
      
      // Try creating presale again (should succeed)
      await expect(
        newSale.createPresale(price, nextStagePrice, tokensToSell, usdtHardcap)
      ).to.not.be.reverted;
    });
  });
}); 