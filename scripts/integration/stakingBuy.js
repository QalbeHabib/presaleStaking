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

  // Buy tokens for each buyer using USDT with immediate staking
  console.log("Buying tokens for buyers...");
  await sale.connect(buyer1Wallet).buyWithUSDT(USDT_AMOUNT, ethers.constants.AddressZero, true);
  await sale.connect(buyer2Wallet).buyWithUSDT(USDT_AMOUNT, buyer1Wallet.address, true);
  await sale.connect(buyer3Wallet).buyWithUSDT(USDT_AMOUNT, buyer2Wallet.address, true);
  await sale.connect(buyer4Wallet).buyWithUSDT(USDT_AMOUNT, buyer3Wallet.address, true);
  console.log("Tokens purchased and staked for all buyers.");

  // Check staking info for each buyer
  const stakingInfo1 = await sale.getUserStakingInfo(buyer1Wallet.address);
  const stakingInfo2 = await sale.getUserStakingInfo(buyer2Wallet.address);
  const stakingInfo3 = await sale.getUserStakingInfo(buyer3Wallet.address);
  const stakingInfo4 = await sale.getUserStakingInfo(buyer4Wallet.address);

  console.log("Staking info for Buyer 1:", {
    stakedAmount: ethers.utils.formatEther(stakingInfo1.stakedAmount),
    stakingTime: new Date(stakingInfo1.stakingTime * 1000).toISOString(),
    unlockTime: new Date(stakingInfo1.unlockTime * 1000).toISOString(),
    isLocked: stakingInfo1.isLocked,
    hasWithdrawn: stakingInfo1.hasWithdrawn,
    potentialReward: ethers.utils.formatEther(stakingInfo1.potentialReward),
    totalClaimable: ethers.utils.formatEther(stakingInfo1.totalClaimable)
  });

  console.log("Staking info for Buyer 2:", {
    stakedAmount: ethers.utils.formatEther(stakingInfo2.stakedAmount),
    stakingTime: new Date(stakingInfo2.stakingTime * 1000).toISOString(),
    unlockTime: new Date(stakingInfo2.unlockTime * 1000).toISOString(),
    isLocked: stakingInfo2.isLocked,
    hasWithdrawn: stakingInfo2.hasWithdrawn,
    potentialReward: ethers.utils.formatEther(stakingInfo2.potentialReward),
    totalClaimable: ethers.utils.formatEther(stakingInfo2.totalClaimable)
  });

  console.log("Staking info for Buyer 3:", {
    stakedAmount: ethers.utils.formatEther(stakingInfo3.stakedAmount),
    stakingTime: new Date(stakingInfo3.stakingTime * 1000).toISOString(),
    unlockTime: new Date(stakingInfo3.unlockTime * 1000).toISOString(),
    isLocked: stakingInfo3.isLocked,
    hasWithdrawn: stakingInfo3.hasWithdrawn,
    potentialReward: ethers.utils.formatEther(stakingInfo3.potentialReward),
    totalClaimable: ethers.utils.formatEther(stakingInfo3.totalClaimable)
  });

  console.log("Staking info for Buyer 4:", {
    stakedAmount: ethers.utils.formatEther(stakingInfo4.stakedAmount),
    stakingTime: new Date(stakingInfo4.stakingTime * 1000).toISOString(),
    unlockTime: new Date(stakingInfo4.unlockTime * 1000).toISOString(),
    isLocked: stakingInfo4.isLocked,
    hasWithdrawn: stakingInfo4.hasWithdrawn,
    potentialReward: ethers.utils.formatEther(stakingInfo4.potentialReward),
    totalClaimable: ethers.utils.formatEther(stakingInfo4.totalClaimable)
  });

  // Get staking program statistics
  const stakingStats = await sale.getStakingStats();
  console.log("Staking program statistics:", {
    totalStaked: ethers.utils.formatEther(stakingStats._totalStaked),
    stakingCap: ethers.utils.formatEther(stakingStats._stakingCap),
    stakingAPY: stakingStats._stakingAPY.toString(),
    isActive: stakingStats._isActive,
    maxRewards: ethers.utils.formatEther(stakingStats._maxRewards),
    totalRewardsCommitted: ethers.utils.formatEther(stakingStats._totalRewardsCommitted),
    remainingRewards: ethers.utils.formatEther(stakingStats._remainingRewards)
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 