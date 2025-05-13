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

  // Stake tokens for each buyer
  console.log("Staking tokens for buyers...");
  await sale.connect(buyer1Wallet).stakeTokens();
  await sale.connect(buyer2Wallet).stakeTokens();
  await sale.connect(buyer3Wallet).stakeTokens();
  await sale.connect(buyer4Wallet).stakeTokens();
  console.log("Tokens staked for all buyers.");

  // Add referrals for each buyer
  console.log("Adding referrals for buyers...");
  await sale.connect(buyer1Wallet).addReferral(buyer2Wallet.address);
  await sale.connect(buyer2Wallet).addReferral(buyer3Wallet.address);
  await sale.connect(buyer3Wallet).addReferral(buyer4Wallet.address);
  await sale.connect(buyer4Wallet).addReferral(buyer1Wallet.address);
  console.log("Referrals added for all buyers.");

  // Check combined info for each buyer
  const stakingInfo1 = await sale.getStakingInfo(buyer1Wallet.address);
  const stakingInfo2 = await sale.getStakingInfo(buyer2Wallet.address);
  const stakingInfo3 = await sale.getStakingInfo(buyer3Wallet.address);
  const stakingInfo4 = await sale.getStakingInfo(buyer4Wallet.address);
  const referralInfo1 = await sale.getReferralInfo(buyer1Wallet.address);
  const referralInfo2 = await sale.getReferralInfo(buyer2Wallet.address);
  const referralInfo3 = await sale.getReferralInfo(buyer3Wallet.address);
  const referralInfo4 = await sale.getReferralInfo(buyer4Wallet.address);
  console.log("Combined info for Buyer 1:", { staking: stakingInfo1, referral: referralInfo1 });
  console.log("Combined info for Buyer 2:", { staking: stakingInfo2, referral: referralInfo2 });
  console.log("Combined info for Buyer 3:", { staking: stakingInfo3, referral: referralInfo3 });
  console.log("Combined info for Buyer 4:", { staking: stakingInfo4, referral: referralInfo4 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 