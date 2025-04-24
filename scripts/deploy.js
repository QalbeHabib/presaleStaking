const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Example values for constructor parameters - replace with your actual values
    const tokenDecimals = 18;
    const totalSupply = ethers.utils.parseUnits("100000000000", tokenDecimals); // 100 billion tokens
    const minTokenToBuy = ethers.utils.parseUnits("10", tokenDecimals); // 10 tokens minimum purchase

    // For testing purposes we'll use the same token for sale and USDT
    // Deploy your token contract first (not shown here) or use an existing token address
    const tokenAddress = process.env.TOKEN_ADDRESS || "YOUR_TOKEN_ADDRESS"; // Replace with your token address

    // Oracle address - use Chainlink ETH/USD price feed for your network
    // Mainnet: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    // Sepolia: 0x694AA1769357215DE4FAC081bf1f309aDC325306
    const oracleAddress = process.env.ORACLE_ADDRESS || "0x694AA1769357215DE4FAC081bf1f309aDC325306";

    console.log("Deploying Sale contract with parameters:");
    console.log("Oracle address:", oracleAddress);
    console.log("Token address (for both sale and USDT):", tokenAddress);
    console.log("Total supply:", ethers.utils.formatUnits(totalSupply, tokenDecimals));
    console.log("Min tokens to buy:", ethers.utils.formatUnits(minTokenToBuy, tokenDecimals));

    // Deploy the Sale contract
    const Sale = await ethers.getContractFactory("Sale");
    const sale = await Sale.deploy(
        oracleAddress,
        tokenAddress,  // USDT address
        tokenAddress,  // Sale token address
        minTokenToBuy,
        totalSupply
    );

    await sale.deployed();
    console.log("Sale contract deployed to:", sale.address);

    // Calculate token allocations
    const presaleTokens = await sale.presaleTokens();
    const maxReferralRewards = await sale.maxReferralRewards();
    const maxStakingRewards = await sale.maxStakingRewards();
    const totalRequired = presaleTokens.add(maxReferralRewards).add(maxStakingRewards);

    console.log("\n--- Token Allocations to Transfer to the Contract ---");
    console.log(`Presale Allocation (30%): ${ethers.utils.formatUnits(presaleTokens, tokenDecimals)} tokens`);
    console.log(`Referral Allocation (5%): ${ethers.utils.formatUnits(maxReferralRewards, tokenDecimals)} tokens`);
    console.log(`Staking Allocation (20%): ${ethers.utils.formatUnits(maxStakingRewards, tokenDecimals)} tokens`);
    console.log(`Total Required (55%): ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens`);

    console.log("\n--- Next Steps ---");
    console.log(`1. Send at least ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens to the contract at ${sale.address}`);
    console.log("2. Call the preFundContract() function on the Sale contract");
    console.log("3. Start creating presales with createPresale()");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 