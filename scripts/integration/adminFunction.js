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

  // Admin operations
  console.log("Performing admin operations...");

  // Pause the contract
  console.log("Pausing the contract...");
  await sale.connect(adminWallet).pause();
  console.log("Contract paused.");

  // Unpause the contract
  console.log("Unpausing the contract...");
  await sale.connect(adminWallet).unpause();
  console.log("Contract unpaused.");

  // Update token price
  console.log("Updating token price...");
  await sale.connect(adminWallet).updateTokenPrice(ethers.utils.parseUnits("2", 18));
  console.log("Token price updated.");

  // Update staking parameters
  console.log("Updating staking parameters...");
  await sale.connect(adminWallet).updateStakingParameters(ethers.utils.parseUnits("0.1", 18), 30);
  console.log("Staking parameters updated.");

  // Update referral parameters
  console.log("Updating referral parameters...");
  await sale.connect(adminWallet).updateReferralParameters(ethers.utils.parseUnits("0.05", 18));
  console.log("Referral parameters updated.");

  // Withdraw funds
  console.log("Withdrawing funds...");
  await sale.connect(adminWallet).withdrawFunds();
  console.log("Funds withdrawn.");

  // Check admin info
  const adminInfo = await sale.getAdminInfo();
  console.log("Admin info:", adminInfo);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 