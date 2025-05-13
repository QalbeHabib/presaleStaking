const { ethers } = require("hardhat");
const { deployTestTokens } = require("./TestTokens");
const { deployMockPriceFeed } = require("./MockPriceFeed");

/**
 * Deploy the Sale contract with test configuration
 * @param {Object} options - Configuration options
 * @param {number} options.minTokensToBuy - Minimum tokens that can be purchased
 * @param {number} options.totalTokenSupply - Total token supply
 * @param {number} options.ethPrice - ETH price in USD
 * @returns {Promise<Object>} Object containing all deployed contracts and test accounts
 */
async function deploySaleContract(options = {}) {
  // Default values
  const minTokensToBuy = options.minTokensToBuy || ethers.utils.parseEther("100"); // 100 tokens minimum
  const totalTokenSupply = options.totalTokenSupply || ethers.utils.parseEther("100000000000"); // 100 billion
  const ethPrice = options.ethPrice || 2000; // $2000 per ETH
  
  // Deploy tokens
  const { saleToken, usdt, deployer } = await deployTestTokens();
  
  // Deploy mock price feed
  const priceFeed = await deployMockPriceFeed(ethPrice);
  
  // Deploy Sale contract
  const Sale = await ethers.getContractFactory("Sale");
  const sale = await Sale.deploy(
    priceFeed.address,
    usdt.address,
    saleToken.address,
    minTokensToBuy,
    totalTokenSupply
  );
  await sale.deployed();
  
  // Pre-fund the contract with tokens (55% of total supply)
  const presaleTokens = totalTokenSupply.mul(30).div(100); // 30% for presale
  const referralRewards = totalTokenSupply.mul(5).div(100); // 5% for referrals
  const stakingRewards = totalTokenSupply.mul(20).div(100); // 20% for staking
  const totalFunding = presaleTokens.add(referralRewards).add(stakingRewards);
  
  // Approve and transfer tokens to the contract
  await saleToken.approve(sale.address, totalFunding);
  await saleToken.transfer(sale.address, totalFunding);
  
  // Call preFundContract to activate the presale
  await sale.preFundContract();
  
  // Create a presale
  const price = ethers.utils.parseUnits("0.01", 6); // $0.01 per token
  const nextStagePrice = ethers.utils.parseUnits("0.015", 6); // $0.015 per token
  const tokensToSell = presaleTokens; // Sell all presale tokens
  const usdtHardcap = ethers.utils.parseUnits("300000", 6); // $300,000 hardcap
  
  await sale.createPresale(price, nextStagePrice, tokensToSell, usdtHardcap);
  await sale.startPresale(); // Start the presale
  
  // Get test accounts
  const signers = await ethers.getSigners();
  const [owner, buyer1, buyer2, referrer] = signers;
  
  // Fund test accounts with USDT
  const buyerUsdtAmount = ethers.utils.parseUnits("10000", 6); // 10,000 USDT
  await usdt.mint(buyer1.address, buyerUsdtAmount);
  await usdt.mint(buyer2.address, buyerUsdtAmount);
  await usdt.mint(referrer.address, buyerUsdtAmount);
  
  return {
    sale,
    saleToken,
    usdt,
    priceFeed,
    owner,
    buyer1,
    buyer2,
    referrer,
    presaleId: 1, // First presale has ID 1
    totalTokenSupply
  };
}

module.exports = {
  deploySaleContract
}; 