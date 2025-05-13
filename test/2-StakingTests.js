const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Staking System Tests", function() {
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
  
  describe("Purchase with Staking", function() {
    it("should allow purchasing with ETH and immediate staking", async function() {
      // Use a significant amount of ETH (0.5 ETH)
      const ethAmount = ethers.utils.parseEther("0.5");
      
      // Buy tokens with ETH and stake
      const buyTx = await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero, // No referrer
        true, // Stake tokens
        { value: ethAmount }
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Check stake info
      const stakeInfo = await sale.userStakes(buyer1.address);
      
      // Verify stake was created
      expect(stakeInfo.stakedAmount).to.be.gt(0);
      expect(stakeInfo.stakingTimestamp).to.be.gt(0);
      
      // Verify unlock timestamp is set to ~1 year from now (365 days)
      const currentTime = await time.latest();
      const oneYearLater = currentTime + 365 * 24 * 60 * 60;
      expect(stakeInfo.unlockTimestamp).to.be.closeTo(oneYearLater, 10); // Allow small deviation due to block times
      
      // Verify user doesn't have a claim record (since tokens are staked)
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(claimData.totalAmount).to.equal(0);
      
      // Verify stake event was emitted
      const stakeEvents = receipt.events.filter(e => e.event === "TokensStaked");
      expect(stakeEvents.length).to.equal(1);
      expect(stakeEvents[0].args.user).to.equal(buyer1.address);
      expect(stakeEvents[0].args.amount).to.equal(stakeInfo.stakedAmount);
    });
    
    it("should allow purchasing with USDT and immediate staking", async function() {
      // Use a significant amount of USDT (1000 USDT)
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT and stake
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero, // No referrer
        true // Stake tokens
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Check stake info
      const stakeInfo = await sale.userStakes(buyer1.address);
      
      // Verify stake was created
      expect(stakeInfo.stakedAmount).to.be.gt(0);
      expect(stakeInfo.stakingTimestamp).to.be.gt(0);
      
      // Verify unlock timestamp is set to ~1 year from now (365 days)
      const currentTime = await time.latest();
      const oneYearLater = currentTime + 365 * 24 * 60 * 60;
      expect(stakeInfo.unlockTimestamp).to.be.closeTo(oneYearLater, 10);
      
      // Verify user doesn't have a claim record (since tokens are staked)
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      expect(claimData.totalAmount).to.equal(0);
      
      // Verify stake event was emitted
      const stakeEvents = receipt.events.filter(e => e.event === "TokensStaked");
      expect(stakeEvents.length).to.equal(1);
      expect(stakeEvents[0].args.user).to.equal(buyer1.address);
      expect(stakeEvents[0].args.amount).to.equal(stakeInfo.stakedAmount);
    });
  });
  
  describe("Staking Rewards", function() {
    it("should calculate 200% APY rewards correctly", async function() {
      // Use USDT to purchase tokens
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT and stake
      await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero,
        true // Stake tokens
      );
      
      // Get the stake info
      const stakeInfo = await sale.userStakes(buyer1.address);
      const stakedAmount = stakeInfo.stakedAmount;
      
      // Calculate expected reward manually (200% of staked amount)
      const expectedReward = stakedAmount.mul(200).div(100);
      
      // Fast forward time to after unlocking (>365 days)
      await time.increase(366 * 24 * 60 * 60);
      
      // Get buyer1's initial balance
      const initialBalance = await saleToken.balanceOf(buyer1.address);
      
      // Withdraw stake
      await sale.connect(buyer1).withdrawStake();
      
      // Get buyer1's final balance
      const finalBalance = await saleToken.balanceOf(buyer1.address);
      
      // Calculate actual received amount
      const receivedAmount = finalBalance.sub(initialBalance);
      
      // Should receive original stake + reward
      const expectedTotal = stakedAmount.add(expectedReward);
      
      // Verify received amount equals staked amount + expected reward
      expect(receivedAmount).to.equal(expectedTotal);
    });
    
    it("should allow withdrawing only after lock period", async function() {
      // Use USDT to purchase tokens
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT and stake
      await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero,
        true // Stake tokens
      );
      
      // Try to withdraw stake immediately (should fail)
      await expect(
        sale.connect(buyer1).withdrawStake()
      ).to.be.revertedWith("Stake still locked");
      
      // Fast forward time but still within lock period (300 days)
      await time.increase(300 * 24 * 60 * 60);
      
      // Try to withdraw stake within lock period (should still fail)
      await expect(
        sale.connect(buyer1).withdrawStake()
      ).to.be.revertedWith("Stake still locked");
      
      // Fast forward time past lock period (366 days total)
      await time.increase(66 * 24 * 60 * 60);
      
      // Now withdrawal should succeed
      await expect(
        sale.connect(buyer1).withdrawStake()
      ).to.not.be.reverted;
      
      // Check that stake was marked as withdrawn
      const stakeInfo = await sale.userStakes(buyer1.address);
      expect(stakeInfo.hasWithdrawn).to.be.true;
    });
  });
  
  describe("Staking Restrictions", function() {
    it("should prevent staking when staking is disabled", async function() {
      // Disable staking
      await sale.connect(owner).setStakingStatus(false);
      
      // Use USDT to try to purchase tokens with staking
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT and try to stake (should fail)
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          usdtAmount,
          ethers.constants.AddressZero,
          true // Try to stake tokens
        )
      ).to.be.revertedWith("Staking inactive");
    });
    
    it("should prevent staking when cap is reached", async function() {
      // Get current staking cap
      const stakingCap = await sale.stakingCap();
      
      // Calculate needed USDT to reach cap
      // This is an approximation and may need adjustment based on token price
      const presale = await sale.presale(presaleId);
      const tokenPrice = presale.price;
      
      // USDT needed = (staking cap * token price) / 10^18
      // This is very approximate!
      const usdtNeeded = stakingCap.mul(tokenPrice).div(ethers.utils.parseUnits("1", 18));
      
      // Let two buyers stake just below the cap
      const buyer1Amount = usdtNeeded.div(2);
      const buyer2Amount = usdtNeeded.div(2);
      
      // Approve and stake for buyer1
      await usdt.connect(buyer1).approve(sale.address, buyer1Amount);
      await sale.connect(buyer1).buyWithUSDT(
        buyer1Amount,
        ethers.constants.AddressZero,
        true // Stake tokens
      );
      
      // Approve and stake for buyer2
      await usdt.connect(buyer2).approve(sale.address, buyer2Amount);
      await sale.connect(buyer2).buyWithUSDT(
        buyer2Amount,
        ethers.constants.AddressZero,
        true // Stake tokens
      );
      
      // Now the staking should be at or near cap, and staking should be disabled
      const stakingStatus = await sale.stakingActive();
      expect(stakingStatus).to.be.false;
      
      // Try to stake more with buyer1 (should fail)
      const smallAmount = ethers.utils.parseUnits("100", 6);
      await usdt.connect(buyer1).approve(sale.address, smallAmount);
      
      await expect(
        sale.connect(buyer1).buyWithUSDT(
          smallAmount,
          ethers.constants.AddressZero,
          true // Try to stake tokens
        )
      ).to.be.revertedWith("Staking inactive");
    });
  });
}); 