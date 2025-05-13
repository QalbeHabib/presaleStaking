const { ethers } = require("hardhat");

/**
 * Deploy mock Chainlink price feed for ETH/USD
 * @param {number} ethPrice - ETH price in USD (default: 2000)
 * @returns {Promise<Object>} The deployed mock price feed contract
 */
async function deployMockPriceFeed(ethPrice = 2000) {
  // Create a mock Chainlink aggregator
  const MockAggregator = await ethers.getContractFactory("MockAggregator");
  const mockPriceFeed = await MockAggregator.deploy();
  await mockPriceFeed.deployed();
  
  // Set ETH price in USD with 8 decimals (Chainlink standard)
  // Only if it's different from the default
  if (ethPrice !== 2000) {
    const priceWithDecimals = ethPrice * 10**8;
    await mockPriceFeed.setLatestAnswer(priceWithDecimals);
  }
  
  return mockPriceFeed;
}

module.exports = {
  deployMockPriceFeed
}; 