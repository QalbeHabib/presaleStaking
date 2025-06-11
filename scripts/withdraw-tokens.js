const hre = require("hardhat");

async function main() {
  console.log("Withdrawing all PresaleTokens from the Sale contract...");

  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  console.log(`Using admin account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  // ===================================================
  // IMPORTANT: UPDATE THESE ADDRESSES
  // ===================================================
  const SALE_ADDRESS = "0x292623C2C9270E99c6391d8b892b97CCe9769539";
  const TOKEN_ADDRESS = "0xddAE530E193C5B287f5Ff3dE62da5D2e1b3722e2";
  // ===================================================

  if (SALE_ADDRESS === "YOUR_SALE_CONTRACT_ADDRESS" || TOKEN_ADDRESS === "YOUR_PRESALE_TOKEN_ADDRESS") {
    console.error("Please update the SALE_ADDRESS and TOKEN_ADDRESS constants in the script.");
    return;
  }

  console.log(`Loading contracts...`);
  const saleContract = await ethers.getContractAt("Sale", SALE_ADDRESS);
  const tokenContract = await ethers.getContractAt("PresaleToken", TOKEN_ADDRESS);

  // 1. Check current balances
  console.log("\n1. Checking initial balances...");
  
  const saleContractTokenBalance = await tokenContract.balanceOf(SALE_ADDRESS);
  console.log(`Sale contract balance: ${ethers.formatEther(saleContractTokenBalance)} PRESALE`);

  const adminTokenBalance = await tokenContract.balanceOf(deployer.address);
  console.log(`Admin wallet balance: ${ethers.formatEther(adminTokenBalance)} PRESALE`);

  if (saleContractTokenBalance === 0n) {
    console.log("\nSale contract has no tokens to withdraw. Exiting.");
    return;
  }

  // 2. Withdraw tokens from the Sale contract
  // The WithdrawAllTokens function is callable only by the owner.
  // No separate approval is needed as the contract owns the tokens.
  console.log("\n2. Calling WithdrawAllTokens function...");

  try {
    const tx = await saleContract.WithdrawAllTokens(TOKEN_ADDRESS);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log("Successfully called WithdrawAllTokens!");
  } catch (error) {
    console.error("\nFailed to withdraw tokens:", error);
    if (error.message.includes("Ownable: caller is not the owner")) {
        console.error("Error details: The wallet you are using is not the owner of the Sale contract.");
    }
    return;
  }

  // 3. Verify final balances
  console.log("\n3. Verifying final balances...");

  const finalSaleBalance = await tokenContract.balanceOf(SALE_ADDRESS);
  console.log(`Final Sale contract balance: ${ethers.formatEther(finalSaleBalance)} PRESALE`);

  const finalAdminBalance = await tokenContract.balanceOf(deployer.address);
  console.log(`Final Admin wallet balance: ${ethers.formatEther(finalAdminBalance)} PRESALE`);

  console.log("\n✅ Withdrawal complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 