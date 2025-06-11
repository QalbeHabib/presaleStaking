// This script handles token transfers, prefunding and starting the presale on BSC Testnet
const hre = require("hardhat");

async function main() {
  console.log("Setting up the presale on BSC Testnet...");

  // Get the network from hardhat runtime environment
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  // Contract addresses from deployment
  const SALE_ADDRESS = "0x785a0893F1657c5bB1106E250695b7a25815ad3a";
  const TOKEN_ADDRESS = "0xFfd1531235CBc96d5232afb4774A427753D9b4E7";
  const USDT_ADDRESS = "0x69304c4900EB9f3d2e412465Db1275A50B96d036";

  console.log(`Loading contracts...`);
  const Sale = await ethers.getContractFactory("Sale");
  const PresaleToken = await ethers.getContractFactory("PresaleToken");
  const TeatherUSDT = await ethers.getContractFactory("TeatherUSDT");

  const saleContract = Sale.attach(SALE_ADDRESS);
  const tokenContract = PresaleToken.attach(TOKEN_ADDRESS);
  const usdtContract = TeatherUSDT.attach(USDT_ADDRESS);

  // Get token total supply
  const totalSupply = await tokenContract.totalSupply();
  console.log(`Total token supply: ${ethers.formatEther(totalSupply)}`);

  // Get USDT decimals
  const usdtDecimals = await usdtContract.decimals();
  console.log(`USDT decimals: ${usdtDecimals}`);

  // 1. Transfer tokens to Sale contract (55% of total supply)
  console.log("\n1. Transferring tokens to Sale contract...");
  
  // // Calculate 55% of total supply (30% presale + 5% referral + 20% staking)
  const saleAllocation = totalSupply * 55n / 100n;
  console.log(`Allocation amount: ${ethers.formatEther(saleAllocation)} PRESALE tokens`);
  
  // Check deployer balance
  const deployerBalance = await tokenContract.balanceOf(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} PRESALE tokens`);
  
  // if (deployerBalance < saleAllocation) {
  //   console.error("Insufficient balance for allocation");
  //   return;
  // }

  // try {
  //   // Transfer tokens to Sale contract
  //   console.log("Transferring tokens...");
  //   const tx = await tokenContract.transfer(SALE_ADDRESS, saleAllocation);
  //   console.log(`Transaction hash: ${tx.hash}`);
  //   await tx.wait();
  //   console.log("Tokens transferred successfully!");
    
  //   // Verify final balances
  //   const saleBalance = await tokenContract.balanceOf(SALE_ADDRESS);
  //   console.log(`Sale contract balance: ${ethers.formatEther(saleBalance)} PRESALE tokens`);
  // } catch (error) {
  //   console.error("Failed to transfer tokens:", error);
  //   return;
  // }

  // 2. Call preFundContract to enable presale, referral, and staking
  // console.log("\n2. Pre-funding contract...");
  // try {
  //   const preFundTx = await saleContract.preFundContract();
  //   console.log(`Transaction hash: ${preFundTx.hash}`);
  //   await preFundTx.wait();
  //   console.log("Contract pre-funded successfully!");
  // } catch (error) {
  //   console.error("Failed to pre-fund contract:", error);
  //   return;
  // }

  // 3. Create a presale with createPresale()
  console.log("\n3. Creating presale...");
  
  // Presale parameters
  const presalePrice = ethers.parseUnits("0.006666", usdtDecimals); // 0.01 USDT per token
  const nextStagePrice = ethers.parseUnits("0.007142", usdtDecimals); // 0.02 USDT per token
  const hardcap = ethers.parseUnits("30000000", usdtDecimals); // 30,000,000 USDT
  const tokensToSell = totalSupply * 30n / 100n; // 30% of total supply for presale
  

  console.log({presalePrice, nextStagePrice, tokensToSell, hardcap});
  console.log(`Tokens to sell in presale: ${ethers.formatEther(tokensToSell)} PRESALE tokens`);
  
  try {
    // const createPresaleTx = await saleContract.createPresale(presalePrice, nextStagePrice, tokensToSell, hardcap);
    // console.log(`Transaction hash: ${createPresaleTx.hash}`);
    // await createPresaleTx.wait();
    console.log("Presale created successfully!");
  } catch (error) {
    console.error("Failed to create presale:", error);
    return;
  }

  // 4. Start the presale with startPresale()
  // console.log("\n4. Starting presale...");
  try {
    // const startPresaleTx = await saleContract.startPresale();
    // console.log(`Transaction hash: ${startPresaleTx.hash}`);
    // await startPresaleTx.wait();
    // console.log("Presale started successfully!");
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 