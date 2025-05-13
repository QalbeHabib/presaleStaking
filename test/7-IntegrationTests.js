const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Integration and End-to-End Tests", function() {
  // Increase timeout for testing
  this.timeout(50000);
  
  let sale, saleToken, usdt, priceFeed;
  let owner, buyer1, buyer2, referrer;
  let presaleId, totalTokenSupply;
  
  before(async function() {
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
  
  describe("Complete Presale Lifecycle", function() {
    it("should execute a full presale lifecycle with all functionalities", async function() {
      /* STAGE 1: PRESALE SETUP AND TOKEN ALLOCATION */
      
      // Verify presale is active
      const presale = await sale.presale(presaleId);
      expect(presale.isActive).to.be.true;
      
      // Verify contract has been funded with tokens
      const contractBalance = await saleToken.balanceOf(sale.address);
      expect(contractBalance).to.be.gt(0);
      
      // Verify staking is active
      const stakingStatus = await sale.stakingActive();
      expect(stakingStatus).to.be.true;
      
      /* STAGE 2: INITIAL PURCHASES */
      
      // First, qualify referrer with a purchase
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const tokenPrice = presale.price;
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      const referrerUsdtAmount = usdtNeeded.mul(2);
      
      await usdt.connect(referrer).approve(sale.address, referrerUsdtAmount);
      await sale.connect(referrer).buyWithUSDT(
        ethers.constants.AddressZero,
        false,
        referrerUsdtAmount
      );
      
      // Verify referrer is qualified
      const isQualified = await sale.hasQualifiedPurchase(referrer.address);
      expect(isQualified).to.be.true;
      
      // Buyer1 purchases with ETH, uses referrer, and stakes
      const ethAmount = ethers.utils.parseEther("1");
      await sale.connect(buyer1).buyWithEth(
        referrer.address,
        true, // Stake
        { value: ethAmount }
      );
      
      // Verify staking worked
      const buyer1StakeInfo = await sale.userStakes(buyer1.address);
      expect(buyer1StakeInfo.stakedAmount).to.be.gt(0);
      
      // Verify referral worked
      const buyer1ReferralData = await sale.referralData(buyer1.address);
      expect(buyer1ReferralData.referrer).to.equal(referrer.address);
      
      // Buyer2 purchases with USDT, uses referrer, but doesn't stake
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer2).approve(sale.address, usdtAmount);
      await sale.connect(buyer2).buyWithUSDT(
        referrer.address,
        false, // Don't stake
        usdtAmount
      );
      
      // Verify buyer2 claim data exists
      const buyer2ClaimData = await sale.userClaimData(buyer2.address, presaleId);
      expect(buyer2ClaimData.totalAmount).to.be.gt(0);
      
      /* STAGE 3: CLAIMING TOKENS (NON-STAKED) */
      
      // Buyer2 claims tokens immediately (since not staked)
      const buyer2InitialBalance = await saleToken.balanceOf(buyer2.address);
      await sale.connect(buyer2).claimTokens(presaleId);
      const buyer2FinalBalance = await saleToken.balanceOf(buyer2.address);
      
      // Verify buyer2 received tokens
      expect(buyer2FinalBalance.sub(buyer2InitialBalance)).to.equal(buyer2ClaimData.totalAmount);
      
      /* STAGE 4: PRESALE ADMIN FUNCTIONS */
      
      // Owner pauses presale
      await sale.connect(owner).pausePresale();
      
      // Verify presale is paused
      const pausedPresale = await sale.presale(presaleId);
      expect(pausedPresale.isActive).to.be.false;
      
      // Try to purchase while paused (should fail)
      await expect(
        sale.connect(buyer2).buyWithEth(
          referrer.address,
          false,
          { value: ethers.utils.parseEther("0.1") }
        )
      ).to.be.revertedWith("Presale not active");
      
      // Owner resumes presale
      await sale.connect(owner).startPresale();
      
      // Verify presale is active again
      const resumedPresale = await sale.presale(presaleId);
      expect(resumedPresale.isActive).to.be.true;
      
      // Owner updates token price (increases it)
      const initialPrice = resumedPresale.price;
      const newPrice = initialPrice.mul(2); // Double the price
      await sale.connect(owner).updatePrice(newPrice);
      
      // Verify price was updated
      const updatedPresale = await sale.presale(presaleId);
      expect(updatedPresale.price).to.equal(newPrice);
      
      /* STAGE 5: PURCHASES AT NEW PRICE */
      
      // Buyer1 makes another purchase (without staking) at new price
      const secondEthAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        referrer.address,
        false, // Don't stake this time
        { value: secondEthAmount }
      );
      
      // Verify buyer1 now has claim data
      const buyer1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(buyer1ClaimData.totalAmount).to.be.gt(0);
      
      /* STAGE 6: CLAIMING REFERRAL REWARDS */
      
      // Check referrer has rewards
      const referrerRewards = await sale.getClaimableReferralRewards(referrer.address);
      expect(referrerRewards).to.be.gt(0);
      
      // Referrer claims rewards
      const referrerInitialBalance = await saleToken.balanceOf(referrer.address);
      await sale.connect(referrer).claimReferralRewards();
      const referrerFinalBalance = await saleToken.balanceOf(referrer.address);
      
      // Verify referrer received rewards
      expect(referrerFinalBalance.sub(referrerInitialBalance)).to.equal(referrerRewards);
      
      /* STAGE 7: WITHDRAWAL OF FUNDS */
      
      // Owner withdraws ETH from contract
      const contractEthBalance = await ethers.provider.getBalance(sale.address);
      expect(contractEthBalance).to.be.gt(0); // Should have ETH from purchases
      
      const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
      const withdrawTx = await sale.connect(owner).withdrawEth();
      const receipt = await withdrawTx.wait();
      
      // Calculate gas costs
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const gasCost = gasUsed.mul(gasPrice);
      
      const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
      
      // Verify owner received ETH (accounting for gas costs)
      const expectedBalance = ownerInitialBalance.add(contractEthBalance).sub(gasCost);
      expect(ownerFinalBalance).to.equal(expectedBalance);
      
      // Verify contract ETH balance is now 0
      const contractFinalEthBalance = await ethers.provider.getBalance(sale.address);
      expect(contractFinalEthBalance).to.equal(0);
      
      /* STAGE 8: FAST FORWARD TO UNLOCK STAKED TOKENS */
      
      // Fast forward time to after staking lock period
      await time.increase(366 * 24 * 60 * 60);
      
      // Buyer1 withdraws staked tokens
      const buyer1InitialBalance = await saleToken.balanceOf(buyer1.address);
      await sale.connect(buyer1).withdrawStake();
      
      // Buyer1 claims regular (non-staked) tokens
      await sale.connect(buyer1).claimTokens(presaleId);
      
      // Buyer1 claims referral rewards
      await sale.connect(buyer1).claimReferralRewards();
      
      // Verify buyer1 final balance includes all three sources of tokens
      const buyer1FinalBalance = await saleToken.balanceOf(buyer1.address);
      const buyer1TotalReceived = buyer1FinalBalance.sub(buyer1InitialBalance);
      
      const expectedStakeWithReward = buyer1StakeInfo.stakedAmount.mul(3); // 200% APY = 3x total
      const expectedClaimTokens = buyer1ClaimData.totalAmount;
      const expectedReferralRewards = await sale.getClaimableReferralRewards(buyer1.address);
      
      const expectedTotal = expectedStakeWithReward.add(expectedClaimTokens).add(expectedReferralRewards);
      
      // Allow some small variance due to potential rounding
      const lowerBound = expectedTotal.mul(99).div(100); // 99% of expected
      const upperBound = expectedTotal.mul(101).div(100); // 101% of expected
      
      expect(buyer1TotalReceived).to.be.gte(lowerBound);
      expect(buyer1TotalReceived).to.be.lte(upperBound);
      
      /* STAGE 9: VERIFY FINAL STATE */
      
      // Verify all users have claimed their tokens
      const finalBuyer1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const finalBuyer2ClaimData = await sale.userClaimData(buyer2.address, presaleId);
      
      expect(finalBuyer1ClaimData.remainingAmount).to.equal(0);
      expect(finalBuyer2ClaimData.remainingAmount).to.equal(0);
      
      // Verify stake has been withdrawn
      const finalBuyer1StakeInfo = await sale.userStakes(buyer1.address);
      expect(finalBuyer1StakeInfo.hasWithdrawn).to.be.true;
      
      // Verify all referral rewards claimed
      const finalReferrerRewards = await sale.getClaimableReferralRewards(referrer.address);
      const finalBuyer1Rewards = await sale.getClaimableReferralRewards(buyer1.address);
      
      expect(finalReferrerRewards).to.equal(0);
      expect(finalBuyer1Rewards).to.equal(0);
    });
  });
  
  describe("Multi-Presale Integration", function() {
    it("should handle multiple presales correctly", async function() {
      // Create a second presale with different parameters
      const price = ethers.utils.parseUnits("0.02", 6); // $0.02 per token
      const nextStagePrice = ethers.utils.parseUnits("0.03", 6); // $0.03 per token
      const tokensToSell = ethers.utils.parseEther("5000000"); // 5 million tokens
      const usdtHardcap = ethers.utils.parseUnits("100000", 6); // $100,000 hardcap
      
      await sale.connect(owner).createPresale(
        price,
        nextStagePrice,
        tokensToSell,
        usdtHardcap
      );
      
      // Get new presale ID
      const newPresaleId = await sale.presaleCounter();
      
      // Start the new presale
      await sale.connect(owner).startPresale();
      
      // Buyer1 buys in new presale with ETH
      const ethAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero, // No referrer this time
        false, // Don't stake
        { value: ethAmount }
      );
      
      // Verify buyer1 has claim data for both presales
      const presale1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const presale2ClaimData = await sale.userClaimData(buyer1.address, newPresaleId);
      
      expect(presale1ClaimData.totalAmount).to.be.gt(0);
      expect(presale2ClaimData.totalAmount).to.be.gt(0);
      
      // Claim tokens from second presale
      const initialBalance = await saleToken.balanceOf(buyer1.address);
      await sale.connect(buyer1).claimTokens(newPresaleId);
      const finalBalance = await saleToken.balanceOf(buyer1.address);
      
      // Verify correct amount was claimed
      expect(finalBalance.sub(initialBalance)).to.equal(presale2ClaimData.totalAmount);
      
      // Verify presale separation - claiming from one doesn't affect the other
      const updatedPresale1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(updatedPresale1ClaimData.totalAmount).to.equal(presale1ClaimData.totalAmount);
    });
  });
}); 