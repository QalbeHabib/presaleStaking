const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySaleContract } = require("./helpers/DeploySale");

describe("Admin Function Tests", function() {
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
  
  describe("Owner-Only Functions", function() {
    it("should allow owner to create a new presale", async function() {
      // Get current presale count
      const initialPresaleCount = await sale.presaleCounter();
      
      // Create a new presale (with different parameters from the default one)
      const price = ethers.utils.parseUnits("0.02", 6); // $0.02 per token
      const nextStagePrice = ethers.utils.parseUnits("0.03", 6); // $0.03 per token
      const tokensToSell = ethers.utils.parseEther("5000000"); // 5 million tokens
      const usdtHardcap = ethers.utils.parseUnits("100000", 6); // $100,000 hardcap
      
      const createTx = await sale.connect(owner).createPresale(
        price,
        nextStagePrice,
        tokensToSell,
        usdtHardcap
      );
      
      // Wait for transaction
      const receipt = await createTx.wait();
      
      // Get updated presale count
      const updatedPresaleCount = await sale.presaleCounter();
      
      // Verify presale count increased
      expect(updatedPresaleCount).to.equal(initialPresaleCount.add(1));
      
      // Verify the newly created presale
      const newPresaleId = updatedPresaleCount;
      const newPresale = await sale.presale(newPresaleId);
      
      expect(newPresale.price).to.equal(price);
      expect(newPresale.nextStagePrice).to.equal(nextStagePrice);
      expect(newPresale.tokensToSell).to.equal(tokensToSell);
      expect(newPresale.UsdtHardcap).to.equal(usdtHardcap);
      expect(newPresale.isActive).to.be.false; // Should not be active yet
      
      // Verify event was emitted
      const events = receipt.events.filter(e => e.event === "PresaleCreated");
      expect(events.length).to.equal(1);
      expect(events[0].args.presaleId).to.equal(newPresaleId);
    });
    
    it("should allow owner to start and pause presale", async function() {
      // Verify initial presale is active
      const initialPresale = await sale.presale(presaleId);
      expect(initialPresale.isActive).to.be.true;
      
      // Pause the presale
      const pauseTx = await sale.connect(owner).pausePresale();
      
      // Verify presale is paused
      const pausedPresale = await sale.presale(presaleId);
      expect(pausedPresale.isActive).to.be.false;
      
      // Try to purchase while paused (should fail)
      const ethAmount = ethers.utils.parseEther("0.5");
      await expect(
        sale.connect(buyer1).buyWithEth(
          ethers.constants.AddressZero,
          false,
          { value: ethAmount }
        )
      ).to.be.revertedWith("Presale not active");
      
      // Start the presale again
      const startTx = await sale.connect(owner).startPresale();
      
      // Verify presale is active again
      const activePresale = await sale.presale(presaleId);
      expect(activePresale.isActive).to.be.true;
      
      // Now purchase should succeed
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        false,
        { value: ethAmount }
      );
      
      // Verify events were emitted
      const pauseReceipt = await pauseTx.wait();
      const startReceipt = await startTx.wait();
      
      const pauseEvents = pauseReceipt.events.filter(e => e.event === "PresalePaused");
      const startEvents = startReceipt.events.filter(e => e.event === "PresaleStarted");
      
      expect(pauseEvents.length).to.equal(1);
      expect(startEvents.length).to.equal(1);
    });
    
    it("should allow owner to update presale price", async function() {
      // Get current price
      const initialPresale = await sale.presale(presaleId);
      const initialPrice = initialPresale.price;
      
      // Set a new price
      const newPrice = ethers.utils.parseUnits("0.02", 6); // $0.02 per token
      const updateTx = await sale.connect(owner).updatePrice(newPrice);
      
      // Verify price was updated
      const updatedPresale = await sale.presale(presaleId);
      expect(updatedPresale.price).to.equal(newPrice);
      
      // Verify event was emitted
      const receipt = await updateTx.wait();
      const events = receipt.events.filter(e => e.event === "PriceUpdated");
      expect(events.length).to.equal(1);
      expect(events[0].args.presaleId).to.equal(presaleId);
      expect(events[0].args.oldPrice).to.equal(initialPrice);
      expect(events[0].args.newPrice).to.equal(newPrice);
    });
    
    it("should allow owner to set staking status", async function() {
      // Verify staking is enabled by default
      const initialStatus = await sale.stakingActive();
      expect(initialStatus).to.be.true;
      
      // Disable staking
      await sale.connect(owner).setStakingStatus(false);
      
      // Verify staking is disabled
      const updatedStatus = await sale.stakingActive();
      expect(updatedStatus).to.be.false;
      
      // Try to stake (should fail)
      const ethAmount = ethers.utils.parseEther("0.5");
      await expect(
        sale.connect(buyer1).buyWithEth(
          ethers.constants.AddressZero,
          true, // Try to stake
          { value: ethAmount }
        )
      ).to.be.revertedWith("Staking inactive");
      
      // Enable staking again
      await sale.connect(owner).setStakingStatus(true);
      
      // Verify staking is enabled
      const finalStatus = await sale.stakingActive();
      expect(finalStatus).to.be.true;
      
      // Now staking should work
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        true, // Stake tokens
        { value: ethAmount }
      );
    });
    
    it("should allow owner to update staking cap", async function() {
      // Get current staking cap
      const initialCap = await sale.stakingCap();
      
      // Set a new cap
      const newCap = initialCap.mul(2); // Double the cap
      await sale.connect(owner).setStakingCap(newCap);
      
      // Verify cap was updated
      const updatedCap = await sale.stakingCap();
      expect(updatedCap).to.equal(newCap);
    });
    
    it("should allow owner to withdraw ETH from contract", async function() {
      // First, make a purchase to get ETH in the contract
      const ethAmount = ethers.utils.parseEther("1");
      await sale.connect(buyer1).buyWithEth(
        ethers.constants.AddressZero,
        false,
        { value: ethAmount }
      );
      
      // Get contract's ETH balance
      const contractBalance = await ethers.provider.getBalance(sale.address);
      expect(contractBalance).to.equal(ethAmount);
      
      // Get owner's initial balance
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      // Owner withdraws ETH
      const withdrawTx = await sale.connect(owner).withdrawEth();
      const receipt = await withdrawTx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const gasCost = gasUsed.mul(gasPrice);
      
      // Get owner's final balance
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      // Verify contract ETH balance is 0
      const finalContractBalance = await ethers.provider.getBalance(sale.address);
      expect(finalContractBalance).to.equal(0);
      
      // Verify owner received the ETH (accounting for gas costs)
      const expectedBalance = initialOwnerBalance.add(contractBalance).sub(gasCost);
      expect(finalOwnerBalance).to.equal(expectedBalance);
    });
    
    it("should allow owner to withdraw ERC20 tokens from contract", async function() {
      // First, send some USDT to the contract directly
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.mint(sale.address, usdtAmount);
      
      // Verify contract has USDT balance
      const contractBalance = await usdt.balanceOf(sale.address);
      expect(contractBalance).to.equal(usdtAmount);
      
      // Get owner's initial balance
      const initialOwnerBalance = await usdt.balanceOf(owner.address);
      
      // Owner withdraws USDT
      await sale.connect(owner).withdrawERC20(usdt.address);
      
      // Verify contract USDT balance is 0
      const finalContractBalance = await usdt.balanceOf(sale.address);
      expect(finalContractBalance).to.equal(0);
      
      // Verify owner received the USDT
      const finalOwnerBalance = await usdt.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(usdtAmount));
    });
  });
  
  describe("Access Control", function() {
    it("should prevent non-owners from calling admin functions", async function() {
      // Try to create a presale as non-owner
      const price = ethers.utils.parseUnits("0.02", 6);
      const nextStagePrice = ethers.utils.parseUnits("0.03", 6);
      const tokensToSell = ethers.utils.parseEther("5000000");
      const usdtHardcap = ethers.utils.parseUnits("100000", 6);
      
      await expect(
        sale.connect(buyer1).createPresale(
          price,
          nextStagePrice,
          tokensToSell,
          usdtHardcap
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to pause presale as non-owner
      await expect(
        sale.connect(buyer1).pausePresale()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to start presale as non-owner
      await expect(
        sale.connect(buyer1).startPresale()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to update price as non-owner
      await expect(
        sale.connect(buyer1).updatePrice(price)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to set staking status as non-owner
      await expect(
        sale.connect(buyer1).setStakingStatus(false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to set staking cap as non-owner
      const newCap = ethers.utils.parseEther("10000000");
      await expect(
        sale.connect(buyer1).setStakingCap(newCap)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to withdraw ETH as non-owner
      await expect(
        sale.connect(buyer1).withdrawEth()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Try to withdraw ERC20 as non-owner
      await expect(
        sale.connect(buyer1).withdrawERC20(usdt.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("should perform admin actions correctly after ownership transfer", async function() {
      // Transfer ownership to buyer1
      await sale.connect(owner).transferOwnership(buyer1.address);
      
      // Verify new owner
      const newOwner = await sale.owner();
      expect(newOwner).to.equal(buyer1.address);
      
      // New owner should be able to perform admin actions
      // Test with setting staking status
      await sale.connect(buyer1).setStakingStatus(false);
      const stakingStatus = await sale.stakingActive();
      expect(stakingStatus).to.be.false;
      
      // Old owner should not be able to perform admin actions anymore
      await expect(
        sale.connect(owner).setStakingStatus(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 