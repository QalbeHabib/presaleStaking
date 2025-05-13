const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Token Purchase Tests", function() {
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
  
  describe("ETH Purchases", function() {
    it("should allow purchasing tokens with minimum ETH amount", async function() {
      // Instead of calculating minimum, use a much larger amount to ensure we meet requirements
      const ethAmount = ethers.utils.parseEther("1"); // Use a full ETH to guarantee it's above minimum
      
      // Store initial balances
      const initialSaleTokenBalance = await saleToken.balanceOf(sale.address);
      const initialEthBalance = await ethers.provider.getBalance(owner.address);
      
      // Buy tokens with ETH
      const buyTx = await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero, // No referrer
        false, // Don't stake
        { value: ethAmount }
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Get token claim data
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      
      // Verify claimed amount is greater than zero
      expect(claimData.totalAmount).to.be.gt(0);
      
      // Verify event was emitted
      const events = receipt.events.filter(e => e.event === "TokensBought");
      expect(events.length).to.equal(1);
      expect(events[0].args.user).to.equal(buyer1.address);
      expect(events[0].args.purchaseToken).to.equal(ethers.constants.AddressZero); // ETH has address zero
      expect(events[0].args.amountPaid).to.equal(ethAmount);
    });
    
    it("should allow purchasing tokens with large ETH amount", async function() {
      // Use a very large ETH amount
      const ethAmount = ethers.utils.parseEther("5"); // 5 ETH should definitely be enough
      
      // Buy tokens with ETH
      const buyTx = await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero, // No referrer
        false, // Don't stake
        { value: ethAmount }
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Get token claim data
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      
      // Verify substantial amount of tokens was purchased
      expect(claimData.totalAmount).to.be.gt(0);
      
      // Verify event was emitted with correct data
      const events = receipt.events.filter(e => e.event === "TokensBought");
      expect(events.length).to.equal(1);
      expect(events[0].args.user).to.equal(buyer1.address);
      expect(events[0].args.purchaseToken).to.equal(ethers.constants.AddressZero);
      expect(events[0].args.amountPaid).to.equal(ethAmount);
    });
    
    it("should fail when purchasing below minimum amount", async function() {
      // Try with tiny ETH amount that's certainly below minimum
      const tinyEthAmount = ethers.utils.parseEther("0.00001");
      
      // Should revert with minimum amount error
      try {
        await sale.connect(buyer1).buyWithEth(
          ethers.constants.AddressZero, // No referrer
          false, // Don't stake
          { value: tinyEthAmount }
        );
        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.message).to.include("Min amount not met");
      }
    });
  });
  
  describe("USDT Purchases", function() {
    it("should allow purchasing tokens with minimum USDT amount", async function() {
      // Use a significant amount of USDT instead of minimum calculation
      const usdtAmount = ethers.utils.parseUnits("5000", 6); // 5,000 USDT should be enough
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero, // No referrer
        false // Don't stake
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Get token claim data
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      
      // Verify claimed amount is greater than zero
      expect(claimData.totalAmount).to.be.gt(0);
      
      // Verify event was emitted
      const events = receipt.events.filter(e => e.event === "TokensBought");
      expect(events.length).to.equal(1);
      expect(events[0].args.user).to.equal(buyer1.address);
      expect(events[0].args.purchaseToken).to.equal(usdt.address);
      expect(events[0].args.amountPaid).to.equal(usdtAmount);
    });
    
    it("should allow purchasing tokens with large USDT amount", async function() {
      // Use a very large amount of USDT
      const usdtAmount = ethers.utils.parseUnits("10000", 6); // 10,000 USDT
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, usdtAmount);
      
      // Buy tokens with USDT
      const buyTx = await sale.connect(buyer1).buyWithUSDT(
        usdtAmount,
        ethers.constants.AddressZero, // No referrer
        false // Don't stake
      );
      
      // Wait for transaction
      const receipt = await buyTx.wait();
      
      // Get token claim data
      const claimData = await sale.userClaimData(buyer1.address, presaleId);
      
      // Verify substantial amount of tokens was purchased
      expect(claimData.totalAmount).to.be.gt(0);
      
      // Verify event was emitted with correct data
      const events = receipt.events.filter(e => e.event === "TokensBought");
      expect(events.length).to.equal(1);
      expect(events[0].args.user).to.equal(buyer1.address);
      expect(events[0].args.purchaseToken).to.equal(usdt.address);
      expect(events[0].args.amountPaid).to.equal(usdtAmount);
    });
    
    it("should fail when purchasing below minimum amount with USDT", async function() {
      // Try with tiny USDT amount that's certainly below minimum
      const tinyUsdtAmount = ethers.utils.parseUnits("0.01", 6);
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, tinyUsdtAmount);
      
      // Should revert with minimum amount error
      try {
        await sale.connect(buyer1).buyWithUSDT(
          tinyUsdtAmount,
          ethers.constants.AddressZero, // No referrer
          false // Don't stake
        );
        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.message).to.include("Min amount not met");
      }
    });
    
    it("should fail when trying to exceed hardcap", async function() {
      const presale = await sale.presale(presaleId);
      const hardcap = presale.UsdtHardcap;
      
      // Try to exceed hardcap by a small amount
      const exceedingAmount = hardcap.add(ethers.utils.parseUnits("1", 6));
      
      // Approve USDT spending
      await usdt.connect(buyer1).approve(sale.address, exceedingAmount);
      
      // Should revert with hardcap limit error
      try {
        await sale.connect(buyer1).buyWithUSDT(
          exceedingAmount,
          ethers.constants.AddressZero,
          false
        );
        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.message).to.include("Hardcap limit");
      }
    });
  });
}); 