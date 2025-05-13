const { ethers } = require("hardhat");

// Contract addresses (update these with your deployed addresses)
const SALE_ADDRESS = "0xDB6aD590d10143123012dD0a3fffeF7AC2f92F9E";
const TOKEN_ADDRESS = "0x8f55e31c026Dc225e3497BE3B6B8f8A5123155CC";
const USDT_ADDRESS = "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f";

// Private keys (load from environment variables)
const ADMIN_PRIVATE_KEY = process.env.PRIVATE_KEY;
const BUYER_1_PRIVATE_KEY = process.env.BUYER_1_PRIVATE_KEY;
const BUYER_2_PRIVATE_KEY = process.env.BUYER_2_PRIVATE_KEY;
const BUYER_3_PRIVATE_KEY = process.env.BUYER_3_PRIVATE_KEY;
const BUYER_4_PRIVATE_KEY = process.env.BUYER_4_PRIVATE_KEY;

// USDT amount to spend (adjust as needed)
const USDT_AMOUNT = ethers.utils.parseUnits("1000", 18);

async function main() {
  // Use the default provider for the current network
  const provider = ethers.provider;

  // Create wallets
  const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  const buyer1Wallet = new ethers.Wallet(BUYER_1_PRIVATE_KEY, provider);
  const buyer2Wallet = new ethers.Wallet(BUYER_2_PRIVATE_KEY, provider);
  const buyer3Wallet = new ethers.Wallet(BUYER_3_PRIVATE_KEY, provider);
  const buyer4Wallet = new ethers.Wallet(BUYER_4_PRIVATE_KEY, provider);

  // Attach to deployed contracts
  const Sale = await ethers.getContractFactory("Sale");
  const PresaleToken = await ethers.getContractFactory("PresaleToken");
  const TeatherUSDT = await ethers.getContractFactory("TeatherUSDT");

  const sale = Sale.attach(SALE_ADDRESS);
  const token = PresaleToken.attach(TOKEN_ADDRESS);
  const usdt = TeatherUSDT.attach(USDT_ADDRESS);

  // Approve USDT spending for each buyer
  console.log("Approving USDT for buyers...");
  await usdt.connect(buyer1Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer2Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer3Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer4Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  console.log("USDT approved for all buyers.");

  // Buy tokens for each buyer
  console.log("Buying tokens for buyers...");
  await sale.connect(buyer1Wallet).buyTokens(USDT_AMOUNT);
  await sale.connect(buyer2Wallet).buyTokens(USDT_AMOUNT);
  await sale.connect(buyer3Wallet).buyTokens(USDT_AMOUNT);
  await sale.connect(buyer4Wallet).buyTokens(USDT_AMOUNT);
  console.log("Tokens purchased for all buyers.");

  // Edge case operations
  console.log("Performing edge case operations...");

  // Buy tokens with zero USDT
  console.log("Buying tokens with zero USDT...");
  try {
    await sale.connect(buyer1Wallet).buyTokens(0);
    console.log("Tokens purchased with zero USDT.");
  } catch (error) {
    console.log("Error buying tokens with zero USDT:", error.message);
  }

  // Buy tokens with insufficient USDT
  console.log("Buying tokens with insufficient USDT...");
  try {
    await sale.connect(buyer1Wallet).buyTokens(ethers.utils.parseUnits("0.1", 18));
    console.log("Tokens purchased with insufficient USDT.");
  } catch (error) {
    console.log("Error buying tokens with insufficient USDT:", error.message);
  }

  // Stake tokens with zero balance
  console.log("Staking tokens with zero balance...");
  try {
    await sale.connect(buyer1Wallet).stakeTokens();
    console.log("Tokens staked with zero balance.");
  } catch (error) {
    console.log("Error staking tokens with zero balance:", error.message);
  }

  // Stake tokens with insufficient balance
  console.log("Staking tokens with insufficient balance...");
  try {
    await sale.connect(buyer1Wallet).stakeTokens();
    console.log("Tokens staked with insufficient balance.");
  } catch (error) {
    console.log("Error staking tokens with insufficient balance:", error.message);
  }

  // Add referral with zero address
  console.log("Adding referral with zero address...");
  try {
    await sale.connect(buyer1Wallet).addReferral(ethers.constants.AddressZero);
    console.log("Referral added with zero address.");
  } catch (error) {
    console.log("Error adding referral with zero address:", error.message);
  }

  // Add referral with self
  console.log("Adding referral with self...");
  try {
    await sale.connect(buyer1Wallet).addReferral(buyer1Wallet.address);
    console.log("Referral added with self.");
  } catch (error) {
    console.log("Error adding referral with self:", error.message);
  }

  // Add referral with existing referral
  console.log("Adding referral with existing referral...");
  try {
    await sale.connect(buyer1Wallet).addReferral(buyer2Wallet.address);
    console.log("Referral added with existing referral.");
  } catch (error) {
    console.log("Error adding referral with existing referral:", error.message);
  }

  // Add referral with circular referral
  console.log("Adding referral with circular referral...");
  try {
    await sale.connect(buyer1Wallet).addReferral(buyer2Wallet.address);
    await sale.connect(buyer2Wallet).addReferral(buyer1Wallet.address);
    console.log("Referral added with circular referral.");
  } catch (error) {
    console.log("Error adding referral with circular referral:", error.message);
  }

  // Check edge case info
  const edgeCaseInfo = await sale.getEdgeCaseInfo();
  console.log("Edge case info:", edgeCaseInfo);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 