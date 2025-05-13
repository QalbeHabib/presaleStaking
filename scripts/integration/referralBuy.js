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

  // Buy tokens for each buyer using USDT with referrals
  console.log("Buying tokens for buyers with referrals...");
  
  // First buyer has no referrer
  await sale.connect(buyer1Wallet).buyWithUSDT(USDT_AMOUNT, ethers.constants.AddressZero, false);
  console.log("Buyer 1 purchased tokens (no referrer)");
  
  // Second buyer refers to first buyer
  await sale.connect(buyer2Wallet).buyWithUSDT(USDT_AMOUNT, buyer1Wallet.address, false);
  console.log("Buyer 2 purchased tokens (referred by Buyer 1)");
  
  // Third buyer refers to second buyer
  await sale.connect(buyer3Wallet).buyWithUSDT(USDT_AMOUNT, buyer2Wallet.address, false);
  console.log("Buyer 3 purchased tokens (referred by Buyer 2)");
  
  // Fourth buyer refers to third buyer
  await sale.connect(buyer4Wallet).buyWithUSDT(USDT_AMOUNT, buyer3Wallet.address, false);
  console.log("Buyer 4 purchased tokens (referred by Buyer 3)");

  // Check user data for each buyer
  const user1 = await sale.users(buyer1Wallet.address);
  const user2 = await sale.users(buyer2Wallet.address);
  const user3 = await sale.users(buyer3Wallet.address);
  const user4 = await sale.users(buyer4Wallet.address);

  console.log("\nUser Data:");
  console.log("Buyer 1:", {
    totalBought: ethers.utils.formatEther(user1.TotalBoughtTokens),
    totalPaid: ethers.utils.formatEther(user1.TotalPaid),
    referralCount: user1.referralCount.toString(),
    referralRewards: ethers.utils.formatEther(user1.referralRewards)
  });

  console.log("Buyer 2:", {
    totalBought: ethers.utils.formatEther(user2.TotalBoughtTokens),
    totalPaid: ethers.utils.formatEther(user2.TotalPaid),
    referralCount: user2.referralCount.toString(),
    referralRewards: ethers.utils.formatEther(user2.referralRewards)
  });

  console.log("Buyer 3:", {
    totalBought: ethers.utils.formatEther(user3.TotalBoughtTokens),
    totalPaid: ethers.utils.formatEther(user3.TotalPaid),
    referralCount: user3.referralCount.toString(),
    referralRewards: ethers.utils.formatEther(user3.referralRewards)
  });

  console.log("Buyer 4:", {
    totalBought: ethers.utils.formatEther(user4.TotalBoughtTokens),
    totalPaid: ethers.utils.formatEther(user4.TotalPaid),
    referralCount: user4.referralCount.toString(),
    referralRewards: ethers.utils.formatEther(user4.referralRewards)
  });

  // Check referral program statistics
  const referralStats = await sale.getReferralStats();
  console.log("\nReferral Program Statistics:", {
    totalReferrals: referralStats.totalReferrals.toString(),
    totalReferralRewards: ethers.utils.formatEther(referralStats.totalReferralRewards),
    maxReferralRewards: ethers.utils.formatEther(referralStats.maxReferralRewards),
    remainingRewards: ethers.utils.formatEther(referralStats.remainingRewards)
  });

  // Check token balances
  const balance1 = await token.balanceOf(buyer1Wallet.address);
  const balance2 = await token.balanceOf(buyer2Wallet.address);
  const balance3 = await token.balanceOf(buyer3Wallet.address);
  const balance4 = await token.balanceOf(buyer4Wallet.address);

  console.log("\nToken Balances:");
  console.log(`Buyer 1: ${ethers.utils.formatEther(balance1)}`);
  console.log(`Buyer 2: ${ethers.utils.formatEther(balance2)}`);
  console.log(`Buyer 3: ${ethers.utils.formatEther(balance3)}`);
  console.log(`Buyer 4: ${ethers.utils.formatEther(balance4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 