// Direct ethers v5 script without hardhat-ethers integration
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load contract ABIs
const SaleABI = require("../artifacts/contracts/Sale.sol/Sale.json").abi;
const PresaleTokenABI = require("../artifacts/contracts/test/PresaleToken.sol/PresaleToken.json").abi;
const TeatherUSDTABI = require("../artifacts/contracts/test/TeatherUSDT.sol/TeatherUSDT.json").abi;

// Contract addresses
const SALE_ADDRESS = "0xDB6aD590d10143123012dD0a3fffeF7AC2f92F9E";
const TOKEN_ADDRESS = "0x8f55e31c026Dc225e3497BE3B6B8f8A5123155CC";
const USDT_ADDRESS = "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f";

// BSC Testnet provider
const provider = new ethers.providers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");

async function main() {
  console.log("Setting up the presale on BSC Testnet using direct ethers...");

  // Load private key from env
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Create wallet
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Using account: ${wallet.address}`);

  // Get contract instances
  const saleContract = new ethers.Contract(SALE_ADDRESS, SaleABI, wallet);
  const tokenContract = new ethers.Contract(TOKEN_ADDRESS, PresaleTokenABI, wallet);
  const usdtContract = new ethers.Contract(USDT_ADDRESS, TeatherUSDTABI, wallet);

  // Get token total supply
  const totalSupply = await tokenContract.totalSupply();
  console.log(`Total token supply: ${ethers.utils.formatEther(totalSupply)}`);

  // Get USDT decimals
  const usdtDecimals = await usdtContract.decimals();
  console.log(`USDT decimals: ${usdtDecimals}`);

  // 1. Transfer tokens to Sale contract (55% of total supply)
  console.log("\n1. Transferring tokens to Sale contract...");
  
  // Calculate 55% of total supply (30% presale + 5% referral + 20% staking)
  const saleAllocation = totalSupply.mul(55).div(100);
  console.log(`Allocation amount: ${ethers.utils.formatEther(saleAllocation)} PRESALE tokens`);
  
  // Check deployer balance
  const deployerBalance = await tokenContract.balanceOf(wallet.address);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} PRESALE tokens`);
  
  if (deployerBalance.lt(saleAllocation)) {
    console.error("Insufficient balance for allocation");
    return;
  }

  try {
    // Transfer tokens to Sale contract
    console.log("Transferring tokens...");
    const tx = await tokenContract.transfer(SALE_ADDRESS, saleAllocation);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log("Tokens transferred successfully!");
    
    // Verify final balances
    const saleBalance = await tokenContract.balanceOf(SALE_ADDRESS);
    console.log(`Sale contract balance: ${ethers.utils.formatEther(saleBalance)} PRESALE tokens`);
  } catch (error) {
    console.error("Failed to transfer tokens:", error);
    return;
  }

  // 2. Call preFundContract to enable presale, referral, and staking
  console.log("\n2. Pre-funding contract...");
  try {
    const preFundTx = await saleContract.preFundContract();
    console.log(`Transaction hash: ${preFundTx.hash}`);
    await preFundTx.wait();
    console.log("Contract pre-funded successfully!");
  } catch (error) {
    console.error("Failed to pre-fund contract:", error);
    return;
  }

  // 3. Create a presale with createPresale()
  console.log("\n3. Creating presale...");
  
  // Presale parameters
  const presalePrice = ethers.utils.parseUnits("0.01", usdtDecimals); // 0.01 USDT per token
  const nextStagePrice = ethers.utils.parseUnits("0.02", usdtDecimals); // 0.02 USDT per token
  const hardcap = ethers.utils.parseUnits("30000000", usdtDecimals); // 30,000,000 USDT
  const tokensToSell = totalSupply.mul(30).div(100); // 30% of total supply for presale
  
  console.log(`Tokens to sell in presale: ${ethers.utils.formatEther(tokensToSell)} PRESALE tokens`);
  
  try {
    const createPresaleTx = await saleContract.createPresale(presalePrice, nextStagePrice, tokensToSell, hardcap);
    console.log(`Transaction hash: ${createPresaleTx.hash}`);
    await createPresaleTx.wait();
    console.log("Presale created successfully!");
  } catch (error) {
    console.error("Failed to create presale:", error);
    return;
  }

  // 4. Start the presale with startPresale()
  console.log("\n4. Starting presale...");
  try {
    const startPresaleTx = await saleContract.startPresale();
    console.log(`Transaction hash: ${startPresaleTx.hash}`);
    await startPresaleTx.wait();
    console.log("Presale started successfully!");
  } catch (error) {
    console.error("Failed to start presale:", error);
    return;
  }

  console.log("\n==== Presale Setup Summary ====");
  console.log("Tokens transferred: ✅");
  console.log("Contract pre-funded: ✅");
  console.log("Presale created: ✅");
  console.log("Presale started: ✅");
  console.log("\nPresale details:");
  console.log(`- Token price: 0.01 USDT`);
  console.log(`- Next stage price: 0.02 USDT`);
  console.log(`- USDT hardcap: 30,000,000 USDT`);
  console.log(`\nContracts:`);
  console.log(`- Sale: ${SALE_ADDRESS}`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- USDT: ${USDT_ADDRESS}`);
  console.log(`\nDashboard: https://testnet.bscscan.com/address/${SALE_ADDRESS}#code`);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 