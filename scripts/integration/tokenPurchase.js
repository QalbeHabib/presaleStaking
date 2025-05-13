const hre = require("hardhat");

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
const USDT_AMOUNT = hre.ethers.parseUnits("1000", 18);

async function main() {
  // Get the network from hardhat runtime environment
  const { ethers, network } = hre;
  console.log(`Network: ${network.name}`);

  // Create wallets using the hardhat provider
  const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, ethers.provider);
  const buyer1Wallet = new ethers.Wallet(BUYER_1_PRIVATE_KEY, ethers.provider);
  const buyer2Wallet = new ethers.Wallet(BUYER_2_PRIVATE_KEY, ethers.provider);
  const buyer3Wallet = new ethers.Wallet(BUYER_3_PRIVATE_KEY, ethers.provider);
  const buyer4Wallet = new ethers.Wallet(BUYER_4_PRIVATE_KEY, ethers.provider);

  console.log("Admin wallet address:", adminWallet.address);
  console.log("Buyer 1 wallet address:", buyer1Wallet.address);
  console.log("Buyer 2 wallet address:", buyer2Wallet.address);
  console.log("Buyer 3 wallet address:", buyer3Wallet.address);
  console.log("Buyer 4 wallet address:", buyer4Wallet.address);

  // Get contract ABIs
  const Sale = await ethers.getContractFactory("Sale");
  const PresaleToken = await ethers.getContractFactory("PresaleToken");
  const TeatherUSDT = await ethers.getContractFactory("TeatherUSDT");

  // Attach to deployed contracts
  const sale = Sale.attach(SALE_ADDRESS);
  const token = PresaleToken.attach(TOKEN_ADDRESS);
  const usdt = TeatherUSDT.attach(USDT_ADDRESS);

  // Get the presale details
  const presaleDetails = await sale.presale(1);
  console.log("Presale Details:", {
    price: ethers.formatUnits(presaleDetails.price, 18),
    nextStagePrice: ethers.formatUnits(presaleDetails.nextStagePrice, 18),
    tokensToSell: ethers.formatEther(presaleDetails.tokensToSell),
    UsdtHardcap: ethers.formatUnits(presaleDetails.UsdtHardcap, 18),
    Active: presaleDetails.Active,
    presaleDetails
  });

  // Approve USDT spending for each buyer
  console.log("\nApproving USDT for buyers...");
  await usdt.connect(buyer1Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer2Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer3Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  await usdt.connect(buyer4Wallet).approve(SALE_ADDRESS, USDT_AMOUNT);
  console.log("USDT approved for all buyers.");

  // Buy tokens for each buyer using USDT
  console.log("\nBuying tokens for buyers...");
  await sale.connect(buyer1Wallet).buyWithUSDT(USDT_AMOUNT, ethers.ZeroAddress, false);
  console.log("Buyer 1 purchased tokens");
  
  await sale.connect(buyer2Wallet).buyWithUSDT(USDT_AMOUNT, buyer1Wallet.address, false);
  console.log("Buyer 2 purchased tokens");
  
  await sale.connect(buyer3Wallet).buyWithUSDT(USDT_AMOUNT, buyer2Wallet.address, false);
  console.log("Buyer 3 purchased tokens");
  
  await sale.connect(buyer4Wallet).buyWithUSDT(USDT_AMOUNT, buyer3Wallet.address, false);
  console.log("Buyer 4 purchased tokens");

  // Check token balances
  console.log("\nChecking token balances...");
  const balance1 = await token.balanceOf(buyer1Wallet.address);
  const balance2 = await token.balanceOf(buyer2Wallet.address);
  const balance3 = await token.balanceOf(buyer3Wallet.address);
  const balance4 = await token.balanceOf(buyer4Wallet.address);
  console.log(`Buyer 1 token balance: ${ethers.formatEther(balance1)}`);
  console.log(`Buyer 2 token balance: ${ethers.formatEther(balance2)}`);
  console.log(`Buyer 3 token balance: ${ethers.formatEther(balance3)}`);
  console.log(`Buyer 4 token balance: ${ethers.formatEther(balance4)}`);

  // Check user data
  console.log("\nChecking user data...");
  const user1 = await sale.users(buyer1Wallet.address);
  const user2 = await sale.users(buyer2Wallet.address);
  const user3 = await sale.users(buyer3Wallet.address);
  const user4 = await sale.users(buyer4Wallet.address);
  console.log("User 1 data:", {
    totalBought: ethers.formatEther(user1.TotalBoughtTokens),
    totalPaid: ethers.formatEther(user1.TotalPaid)
  });
  console.log("User 2 data:", {
    totalBought: ethers.formatEther(user2.TotalBoughtTokens),
    totalPaid: ethers.formatEther(user2.TotalPaid)
  });
  console.log("User 3 data:", {
    totalBought: ethers.formatEther(user3.TotalBoughtTokens),
    totalPaid: ethers.formatEther(user3.TotalPaid)
  });
  console.log("User 4 data:", {
    totalBought: ethers.formatEther(user4.TotalBoughtTokens),
    totalPaid: ethers.formatEther(user4.TotalPaid)
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 