// This script handles token transfers, prefunding and starting the presale on BSC Testnet
const hre = require("hardhat");

async function main() {
  console.log("Setting up the presale on Sepolia...");

  // Get the network from hardhat runtime environment
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  // Contract addresses from deployment
  const SALE_ADDRESS = "0x98756335Fc967785FC5Bc5b8A09bbb08CB2dD6bD";
  const TOKEN_ADDRESS = "0xddAE530E193C5B287f5Ff3dE62da5D2e1b3722e2";
  const USDT_ADDRESS = "0x4Df3306E47D620CbadAAB4a8cEB3AA4d7c5caB74";

  console.log(`Loading contracts...`);
  const saleContract = await ethers.getContractAt("Sale", SALE_ADDRESS);
  const tokenContract = await ethers.getContractAt("PresaleToken", TOKEN_ADDRESS);
  const usdtContract = await ethers.getContractAt("TeatherUSDT", USDT_ADDRESS);

  // Get token total supply
  const totalSupply = await tokenContract.totalSupply();
  console.log(`Total token supply: ${ethers.formatEther(totalSupply)}`);

  // Get USDT decimals
  const usdtDecimals = await usdtContract.decimals();
  console.log(`USDT decimals: ${usdtDecimals}`);

  // 1. Transfer tokens to Sale contract (55% of total supply)
  console.log("\n1. Transferring tokens to Sale contract...");
  
  // Calculate 55% of total supply (30% presale + 5% referral + 20% staking)
  const saleAllocation = totalSupply * 55n / 100n;
  console.log(`Allocation amount: ${ethers.formatEther(saleAllocation)} PRESALE tokens`);
  
  // Check deployer balance
  const deployerBalance = await tokenContract.balanceOf(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} PRESALE tokens`);
  
  if (deployerBalance < saleAllocation) {
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
    console.log(`Sale contract balance: ${ethers.formatEther(saleBalance)} PRESALE tokens`);
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

  // Calculate token prices using the contract function
  const presaleTokenPrice = await saleContract.calculatePriceForTokens(150, 1000000); // 150 tokens for $1
  const nextStageTokenPrice = await saleContract.calculatePriceForTokens(140, 1000000); // 140 tokens for $1 (more expensive)
  
  console.log(`Calculated presale price: ${presaleTokenPrice.toString()}`);
  console.log(`Calculated next stage price: ${nextStageTokenPrice.toString()}`);
  
  // Presale parameters
  const tokensToSell = totalSupply * 30n / 100n; // 30% of total supply for presale
  const hardcap = ethers.parseUnits("30000000", usdtDecimals); // 30,000,000 USDT
  
  console.log(`Tokens to sell in presale: ${ethers.formatEther(tokensToSell)} PRESALE tokens`);
  console.log(`USDT hardcap: ${ethers.formatUnits(hardcap, usdtDecimals)} USDT`);
  
  try {
    const createPresaleTx = await saleContract.createPresale(
      presaleTokenPrice, 
      nextStageTokenPrice, 
      tokensToSell, 
      hardcap
    );
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
  console.log(`- Price for 150 tokens per $1 USDT`);
  console.log(`- Next stage: 140 tokens per $1 USDT (more expensive)`);
  console.log(`- USDT hardcap: ${ethers.formatUnits(hardcap, usdtDecimals)} USDT`);
  console.log(`\nContracts:`);
  console.log(`- Sale: ${SALE_ADDRESS}`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- USDT: ${USDT_ADDRESS}`);
  console.log(`\nDashboard: https://sepolia.etherscan.io/address/${SALE_ADDRESS}#code`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 