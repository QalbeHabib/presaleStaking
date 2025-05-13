const hre = require("hardhat");

// Script to check and withdraw all funds
async function checkAndWithdrawFunds() {
  // Get ethers from hardhat runtime environment
  const { ethers } = hre;
  
  // Contract addresses
  const SALE_ADDRESS = "0x4eAA2f633164ddF3D16695aEbA718cB3B1Ad555c";
  const TOKEN_ADDRESS = "0x8f55e31c026Dc225e3497BE3B6B8f8A5123155CC";
  
  console.log("Network:", hre.network.name);
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  try {
    // Get contract instances
    const Sale = await ethers.getContractFactory("Sale");
    const saleContract = Sale.attach(SALE_ADDRESS);
    
    // Get token contract using getContractAt for interfaces
    const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);
    
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(SALE_ADDRESS);
    console.log("Contract ETH balance:", ethers.formatEther(ethBalance), "ETH");
    
    // Check token balance
    const tokenBalance = await token.balanceOf(SALE_ADDRESS);
    console.log("Contract token balance:", ethers.formatEther(tokenBalance), "tokens");
    
    // Withdraw all ETH if there's a balance
    if (ethBalance > 0) {
      console.log("Withdrawing all ETH...");
      const tx = await saleContract.WithdrawAllContractFunds();
      await tx.wait();
      console.log("ETH withdrawn successfully");
    } else {
      console.log("No ETH to withdraw");
    }
    
    // Withdraw all available tokens if there's a balance
    if (tokenBalance > 0) {
      console.log("Withdrawing all available tokens...");
      const tx = await saleContract.WithdrawAllTokens(TOKEN_ADDRESS);
      await tx.wait();
      console.log("Tokens withdrawn successfully");
    } else {
      console.log("No tokens to withdraw");
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

// Execute the function
checkAndWithdrawFunds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });