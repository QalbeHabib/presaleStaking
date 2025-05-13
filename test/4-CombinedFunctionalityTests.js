const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Combined Functionality Tests", function() {
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
    
    // Qualify referrer with a purchase
    const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
    const presale = await sale.presale(presaleId);
    const tokenPrice = presale.price;
    const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
    const usdtAmount = usdtNeeded.mul(2);
    
    await usdt.connect(referrer).approve(sale.address, usdtAmount);
    await sale.connect(referrer).buyWithUSDT(
      usdtAmount,
      ethers.constants.AddressZero,
      false
    );
  });
  
  describe("ETH Purchase with Referral and Staking", function() {
    it("should correctly process purchase with both referral and staking", async function() {
      // Use a significant amount of ETH (0.5 ETH)
      const ethAmount = ethers.utils.parseEther("0.5");
      
      // Buy tokens with ETH, referral, and staking
      const buyTx = await sale.connect(buyer1).buyWithEth(
        referrer.address, // Use referrer
        true, // Stake tokens
        { value: ethAmount }
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // 1. Verify referral was recorded
      const referralData = await sale.referralData(buyer1.address);
      expect(referralData.referrer).to.equal(referrer.address);
      
      // 2. Verify stake was created
      const stakeInfo = await sale.userStakes(buyer1.address);
      expect(stakeInfo.stakedAmount).to.be.gt(0);
      
      // 3. Verify no claim data (tokens are staked)
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(claimData.totalAmount).to.equal(0);
      
      // 4. Verify referral rewards for both referrer and buyer
      expect(referralData.totalReferralRewards).to.be.gt(0);
      
      const referrerReferralData = await sale.referralData(referrer.address);
      expect(referrerReferralData.totalReferralRewards).to.be.gt(0);
      expect(referrerReferralData.totalReferralRewards).to.equal(referralData.totalReferralRewards);
      
      // 5. Verify stake event was emitted
      const stakeEvents = receipt.events.filter(e => e.event === "TokensStaked");
      expect(stakeEvents.length).to.equal(1);
      
      // 6. Verify referral event was emitted
      const referralEvents = receipt.events.filter(e => e.event === "ReferralRecorded");
      expect(referralEvents.length).to.equal(1);
      
      // 7. Verify referral rewards event was emitted
      const rewardEvents = receipt.events.filter(e => e.event === "ReferralRewardsAdded");
      expect(rewardEvents.length).to.equal(1);
    });
    
    it("should allow claiming both staking rewards and referral rewards after unlock", async function() {
      // Buy tokens with ETH, referral, and staking
      const ethAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        referrer.address, // Use referrer
        true, // Stake tokens
        { value: ethAmount }
      );
      
      // Fast forward time to after unlocking (>365 days)
      await time.increase(366 * 24 * 60 * 60);
      
      // Get initial balances
      const initialBuyerBalance = await saleToken.balanceOf(buyer1.address);
      const initialReferrerBalance = await saleToken.balanceOf(referrer.address);
      
      // Get expected rewards
      const stakeInfo = await sale.userStakes(buyer1.address);
      const stakedAmount = stakeInfo.stakedAmount;
      
      // Calculate expected staking reward (200% of staked amount)
      const expectedStakingReward = stakedAmount.mul(200).div(100);
      const expectedStakingTotal = stakedAmount.add(expectedStakingReward);
      
      // Get expected referral rewards
      const buyerReferralRewards = await sale.getClaimableReferralRewards(buyer1.address);
      const referrerReferralRewards = await sale.getClaimableReferralRewards(referrer.address);
      
      // 1. Withdraw stake for buyer
      await sale.connect(buyer1).withdrawStake();
      
      // 2. Claim referral rewards for both
      await sale.connect(buyer1).claimReferralRewards();
      await sale.connect(referrer).claimReferralRewards();
      
      // Get final balances
      const finalBuyerBalance = await saleToken.balanceOf(buyer1.address);
      const finalReferrerBalance = await saleToken.balanceOf(referrer.address);
      
      // Calculate actual received amounts
      const buyerReceivedAmount = finalBuyerBalance.sub(initialBuyerBalance);
      const referrerReceivedAmount = finalReferrerBalance.sub(initialReferrerBalance);
      
      // Expected total for buyer: stake + stake rewards + referral rewards
      const expectedBuyerTotal = expectedStakingTotal.add(buyerReferralRewards);
      
      // Verify received amounts
      expect(buyerReceivedAmount).to.equal(expectedBuyerTotal);
      expect(referrerReceivedAmount).to.equal(referrerReferralRewards);
      
      // Verify no more rewards to claim
      const remainingBuyerRewards = await sale.getClaimableReferralRewards(buyer1.address);
      const remainingReferrerRewards = await sale.getClaimableReferralRewards(referrer.address);
      expect(remainingBuyerRewards).to.equal(0);
      expect(remainingReferrerRewards).to.equal(0);
    });
  });
  
  describe("USDT Purchase with Referral and Staking", function() {
    it("should correctly process USDT purchase with both referral and staking", async function() {
      // Use a significant amount of USDT (1000 USDT)
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT, referral, and staking
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        referrer.address, // Use referrer
        true, // Stake tokens
        usdtAmount
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // 1. Verify referral was recorded
      const referralData = await sale.referralData(buyer1.address);
      expect(referralData.referrer).to.equal(referrer.address);
      
      // 2. Verify stake was created
      const stakeInfo = await sale.userStakes(buyer1.address);
      expect(stakeInfo.stakedAmount).to.be.gt(0);
      
      // 3. Verify no claim data (tokens are staked)
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(claimData.totalAmount).to.equal(0);
      
      // 4. Verify referral rewards for both referrer and buyer
      expect(referralData.totalReferralRewards).to.be.gt(0);
      
      const referrerReferralData = await sale.referralData(referrer.address);
      expect(referrerReferralData.totalReferralRewards).to.be.gt(0);
      expect(referrerReferralData.totalReferralRewards).to.equal(referralData.totalReferralRewards);
      
      // 5. Verify events were emitted
      const stakeEvents = receipt.events.filter(e => e.event === "TokensStaked");
      const referralEvents = receipt.events.filter(e => e.event === "ReferralRecorded");
      const rewardEvents = receipt.events.filter(e => e.event === "ReferralRewardsAdded");
      
      expect(stakeEvents.length).to.equal(1);
      expect(referralEvents.length).to.equal(1);
      expect(rewardEvents.length).to.equal(1);
    });
  });
  
  describe("Multi-User System-Wide Tests", function() {
    it("should handle multiple users with different combinations of referrals and staking", async function() {
      // Multiple test scenarios with different users:
      
      // Setup: Buyer1 buys with referrer and stakes
      const usdtAmount1 = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, usdtAmount1);
      await sale.connect(buyer1).buyWithUSDT(
        referrer.address,
        true, // Stake
        usdtAmount1
      );
      
      // Setup: Buyer2 buys with referrer but doesn't stake
      const usdtAmount2 = ethers.utils.parseUnits("500", 6);
      await usdt.connect(buyer2).approve(sale.address, usdtAmount2);
      await sale.connect(buyer2).buyWithUSDT(
        referrer.address,
        false, // Don't stake
        usdtAmount2
      );
      
      // Check results for Buyer1
      const buyer1Stake = await sale.userStakes(buyer1.address);
      const buyer1Referral = await sale.referralData(buyer1.address);
      
      expect(buyer1Stake.stakedAmount).to.be.gt(0);
      expect(buyer1Referral.referrer).to.equal(referrer.address);
      expect(buyer1Referral.totalReferralRewards).to.be.gt(0);
      
      // Check results for Buyer2
      const buyer2Stake = await sale.userStakes(buyer2.address);
      const buyer2Referral = await sale.referralData(buyer2.address);
      const buyer2ClaimData = await sale.userClaimData(buyer2.address, presaleId);
      
      expect(buyer2Stake.stakedAmount).to.equal(0); // No stake
      expect(buyer2Referral.referrer).to.equal(referrer.address);
      expect(buyer2Referral.totalReferralRewards).to.be.gt(0);
      expect(buyer2ClaimData.totalAmount).to.be.gt(0); // Has claimable tokens
      
      // Check referrer rewards
      const referrerData = await sale.referralData(referrer.address);
      const expectedTotalReward = buyer1Referral.totalReferralRewards.add(buyer2Referral.totalReferralRewards);
      expect(referrerData.totalReferralRewards).to.equal(expectedTotalReward);
      
      // Test claiming tokens for Buyer2 (not staked)
      const initialBuyer2Balance = await saleToken.balanceOf(buyer2.address);
      await sale.connect(buyer2).claimTokens(presaleId);
      const finalBuyer2Balance = await saleToken.balanceOf(buyer2.address);
      
      expect(finalBuyer2Balance.sub(initialBuyer2Balance)).to.equal(buyer2ClaimData.totalAmount);
    });
    
    it("should handle a full cycle: purchase, referral, staking, and claiming all rewards", async function() {
      // 1. First purchase: Buyer1 buys with USDT via referrer and stakes
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        referrer.address,
        true, // Stake
        usdtAmount
      );
      
      // 2. Second purchase: Buyer1 buys more with ETH via same referrer but doesn't stake
      const ethAmount = ethers.utils.parseEther("0.5");
      await sale.connect(buyer1).buyWithEth(
        referrer.address,
        false, // Don't stake this time
        { value: ethAmount }
      );
      
      // 3. Fast forward to after staking unlock
      await time.increase(366 * 24 * 60 * 60);
      
      // 4. Get all initial balances
      const initialBuyer1Balance = await saleToken.balanceOf(buyer1.address);
      const initialReferrerBalance = await saleToken.balanceOf(referrer.address);
      
      // 5. Get all expected rewards
      const buyer1Stake = await sale.userStakes(buyer1.address);
      const buyer1ReferralRewards = await sale.getClaimableReferralRewards(buyer1.address);
      const buyer1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      const referrerReferralRewards = await sale.getClaimableReferralRewards(referrer.address);
      
      // Calculate expected staking rewards (200% APY)
      const stakingReward = buyer1Stake.stakedAmount.mul(200).div(100);
      
      // 6. Claim everything
      await sale.connect(buyer1).withdrawStake(); // Withdraw stake and rewards
      await sale.connect(buyer1).claimReferralRewards(); // Claim referral rewards
      await sale.connect(buyer1).claimTokens(presaleId); // Claim purchased tokens
      await sale.connect(referrer).claimReferralRewards(); // Referrer claims rewards
      
      // 7. Get final balances
      const finalBuyer1Balance = await saleToken.balanceOf(buyer1.address);
      const finalReferrerBalance = await saleToken.balanceOf(referrer.address);
      
      // 8. Calculate expected totals
      const expectedBuyer1Total = initialBuyer1Balance
        .add(buyer1Stake.stakedAmount) // Original stake
        .add(stakingReward) // Staking rewards
        .add(buyer1ReferralRewards) // Referral rewards
        .add(buyer1ClaimData.totalAmount); // Claimed tokens
      
      const expectedReferrerTotal = initialReferrerBalance
        .add(referrerReferralRewards); // Referrer rewards
      
      // 9. Verify final balances
      expect(finalBuyer1Balance).to.equal(expectedBuyer1Total);
      expect(finalReferrerBalance).to.equal(expectedReferrerTotal);
      
      // 10. Verify no more rewards or claims
      const remainingBuyer1Rewards = await sale.getClaimableReferralRewards(buyer1.address);
      const remainingReferrerRewards = await sale.getClaimableReferralRewards(referrer.address);
      const remainingBuyer1ClaimData = await sale.userClaimData(buyer1.address, presaleId);
      
      expect(remainingBuyer1Rewards).to.equal(0);
      expect(remainingReferrerRewards).to.equal(0);
      expect(remainingBuyer1ClaimData.remainingAmount).to.equal(0);
    });
  });
}); 