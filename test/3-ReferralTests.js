const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Referral System Tests", function() {
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
  
  describe("Referral Registration", function() {
    it("should qualify a user as referrer after purchase", async function() {
      // Get minimum purchase to qualify as referrer
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      
      // Calculate USDT needed for minimum purchase
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      
      // USDT needed = (min tokens * token price) / 10^18
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Make sure the amount is sufficient
      const usdtAmount = usdtNeeded.mul(2); // Double to be safe
      
      // Approve USDT spending
      await usdt.connect(referrer).approve(sale.address, usdtAmount);
      
      // Buy tokens to qualify as referrer
      await sale.connect(referrer).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero, // No referrer for this purchase
        false // Don't stake
      );
      
      // Verify referrer is now qualified
      const isQualified = await sale.hasQualifiedPurchase(referrer.address);
      expect(isQualified).to.be.true;
    });
    
    it("should register referrer during ETH purchase", async function() {
      // First qualify referrer with a purchase
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
      
      // Now buyer1 purchases with referrer
      const ethAmount = ethers.utils.parseEther("0.5");
      const buyTx = await sale.connect(buyer1).buyWithEth(
        referrer.address, // Use referrer
        false, // Don't stake
        { value: ethAmount }
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Verify referral relationship
      const referralData = await sale.referralData(buyer1.address);
      expect(referralData.referrer).to.equal(referrer.address);
      
      // Verify buyer has used a referral
      const hasUsedReferral = await sale.hasUsedReferral(buyer1.address);
      expect(hasUsedReferral).to.be.true;
      
      // Verify referral event was emitted
      const referralEvents = receipt.events.filter(e => e.event === "ReferralRecorded");
      expect(referralEvents.length).to.equal(1);
      expect(referralEvents[0].args.referrer).to.equal(referrer.address);
      expect(referralEvents[0].args.referee).to.equal(buyer1.address);
    });
    
    it("should register referrer during USDT purchase", async function() {
      // First qualify referrer with a purchase
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
      
      // Now buyer1 purchases with referrer
      const buyerUsdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        buyerUsdtAmount,
        referrer.address, // Use referrer
        false // Don't stake
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Verify referral relationship
      const referralData = await sale.referralData(buyer1.address);
      expect(referralData.referrer).to.equal(referrer.address);
      
      // Verify buyer has used a referral
      const hasUsedReferral = await sale.hasUsedReferral(buyer1.address);
      expect(hasUsedReferral).to.be.true;
      
      // Verify referral event was emitted
      const referralEvents = receipt.events.filter(e => e.event === "ReferralRecorded");
      expect(referralEvents.length).to.equal(1);
      expect(referralEvents[0].args.referrer).to.equal(referrer.address);
      expect(referralEvents[0].args.referee).to.equal(buyer1.address);
    });
    
    it("should fail to use unqualified referrer", async function() {
      // Try to use buyer2 as a referrer without qualifying them first
      const ethAmount = ethers.utils.parseEther("0.5");
      
      // Should revert with unqualified referrer error
      await expect(
        sale.connect(buyer1).buyWithEth(
          buyer2.address, // Unqualified referrer
          false,
          { value: ethAmount }
        )
      ).to.be.revertedWith("Unqualified referrer");
    });
  });
  
  describe("Referral Rewards", function() {
    it("should calculate 20% reward correctly", async function() {
      // First qualify referrer with a purchase
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      const referrerUsdtAmount = usdtNeeded.mul(2);
      
      await usdt.connect(referrer).approve(sale.address, referrerUsdtAmount);
      await sale.connect(referrer).buyWithUSDT(
        referrerUsdtAmount,
        ethers.constants.AddressZero,
        false
      );
      
      // Now buyer1 purchases with referrer
      const buyerUsdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        buyerUsdtAmount,
        referrer.address,
        false
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Get purchased tokens amount from event
      const buyEvents = receipt.events.filter(e => e.event === "TokensBought");
      const tokensBought = buyEvents[0].args.tokensBought;
      
      // Get referral percentage
      const referralPercentage = await sale.referralRewardPercentage();
      
      // Calculate expected reward manually (20% of tokens bought by default)
      const expectedReward = tokensBought.mul(referralPercentage).div(100);
      
      // Get actual referral rewards
      const referrerData = await sale.referralData(referrer.address);
      const buyerData = await sale.referralData(buyer1.address);
      
      // Verify both referrer and buyer get equal rewards
      expect(referrerData.totalReferralRewards).to.equal(expectedReward);
      expect(buyerData.totalReferralRewards).to.equal(expectedReward);
      
      // Verify reward event was emitted
      const rewardEvents = receipt.events.filter(e => e.event === "ReferralRewardsAdded");
      expect(rewardEvents.length).to.equal(1);
      expect(rewardEvents[0].args.referrer).to.equal(referrer.address);
      expect(rewardEvents[0].args.referee).to.equal(buyer1.address);
      expect(rewardEvents[0].args.referrerReward).to.equal(expectedReward);
      expect(rewardEvents[0].args.refereeReward).to.equal(expectedReward);
    });
    
    it("should allow claiming referral rewards", async function() {
      // First qualify referrer with a purchase
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      const referrerUsdtAmount = usdtNeeded.mul(2);
      
      await usdt.connect(referrer).approve(sale.address, referrerUsdtAmount);
      await sale.connect(referrer).buyWithUSDT(
        referrerUsdtAmount,
        ethers.constants.AddressZero,
        false
      );
      
      // Now buyer1 purchases with referrer
      const buyerUsdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        buyerUsdtAmount,
        referrer.address,
        false
      );
      
      // Get referrer's initial balance
      const initialBalance = await saleToken.balanceOf(referrer.address);
      
      // Check claimable rewards
      const claimableRewards = await sale.getClaimableReferralRewards(referrer.address);
      expect(claimableRewards).to.be.gt(0);
      
      // Claim referral rewards
      const claimTx = await sale.connect(referrer).claimReferralRewards();
      const receipt = await claimTx.wait();
      
      // Get referrer's final balance
      const finalBalance = await saleToken.balanceOf(referrer.address);
      
      // Verify balance increased by the claimed amount
      expect(finalBalance.sub(initialBalance)).to.equal(claimableRewards);
      
      // Verify claim event was emitted
      const claimEvents = receipt.events.filter(e => e.event === "ReferralRewardsClaimed");
      expect(claimEvents.length).to.equal(1);
      expect(claimEvents[0].args.user).to.equal(referrer.address);
      expect(claimEvents[0].args.amount).to.equal(claimableRewards);
      
      // Verify updated claim status
      const referrerData = await sale.referralData(referrer.address);
      expect(referrerData.claimedReferralRewards).to.equal(claimableRewards);
      
      // Verify no more rewards to claim
      const remainingRewards = await sale.getClaimableReferralRewards(referrer.address);
      expect(remainingRewards).to.equal(0);
    });
  });
  
  describe("Referral Restrictions", function() {
    it("should prevent self-referral", async function() {
      // Try to use self as referrer
      const ethAmount = ethers.utils.parseEther("0.5");
      
      // Should revert with invalid referrer error
      await expect(
        sale.connect(buyer1).buyWithEth(
          buyer1.address, // Self-referral
          false,
          { value: ethAmount }
        )
      ).to.be.revertedWith("Invalid referrer");
    });
    
    it("should prevent circular referrals", async function() {
      // First qualify buyer1 as referrer
      const minPurchase = await sale.MINIMUM_PURCHASE_FOR_REFERRAL();
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      const usdtNeeded = minPurchase.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      const usdtAmount = usdtNeeded.mul(2);
      
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero,
        false
      );
      
      // Qualify buyer2 as referrer
      await usdt.connect(buyer2).approve(sale.address, usdtAmount);
      await sale.connect(buyer2).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero,
        false
      );
      
      // Now buyer1 sets buyer2 as referrer
      const buyerUsdtAmount = ethers.utils.parseUnits("500", 6);
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        buyerUsdtAmount,
        buyer2.address,
        false
      );
      
      // Now try to make buyer2 use buyer1 as referrer - should fail (circular)
      await usdt.connect(buyer2).approve(sale.address, buyerUsdtAmount);
      await expect(
        sale.connect(buyer2).buyWithUSDT(
          buyerUsdtAmount,
          buyer1.address,
          false
        )
      ).to.be.revertedWith("Circular referral");
    });
    
    it("should prevent using multiple referrers", async function() {
      // First qualify referrer and buyer2 as referrers
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
      
      await usdt.connect(buyer2).approve(sale.address, usdtAmount);
      await sale.connect(buyer2).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero,
        false
      );
      
      // Now buyer1 uses referrer
      const buyerUsdtAmount = ethers.utils.parseUnits("500", 6);
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      await sale.connect(buyer1).buyWithUSDT(
        buyerUsdtAmount,
        referrer.address,
        false
      );
      
      // Try to use buyer2 as a different referrer - should fail
      await usdt.connect(buyer1).approve(sale.address, buyerUsdtAmount);
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          buyerUsdtAmount,
          buyer2.address,
          false
        )
      ).to.be.revertedWith("Already referred");
    });
  });
}); 