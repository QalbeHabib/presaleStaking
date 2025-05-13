const { ethers } = require("hardhat");

/**
 * Deploy mock ERC20 tokens for testing
 * @returns {Promise<Object>} Object containing the deployed token contracts
 */
async function deployTestTokens() {
  const [deployer] = await ethers.getSigners();
  
  // Deploy Sale token with 18 decimals
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const saleToken = await ERC20Mock.deploy("Sale Token", "SALE", 18);
  await saleToken.deployed();
  
  // Deploy USDT with 6 decimals (as in real world)
  const usdt = await ERC20Mock.deploy("USDT", "USDT", 6);
  await usdt.deployed();
  
  // Mint initial supply to deployer
  const saleTokenAmount = ethers.utils.parseEther("100000000000"); // 100 billion tokens with 18 decimals
  const usdtAmount = ethers.utils.parseUnits("1000000", 6); // 1 million USDT with 6 decimals
  
  await saleToken.mint(deployer.address, saleTokenAmount);
  await usdt.mint(deployer.address, usdtAmount);
  
  return { saleToken, usdt, deployer };
}

module.exports = {
  deployTestTokens
}; 