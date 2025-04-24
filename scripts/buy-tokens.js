const { ethers } = require("hardhat");

async function main() {
    const [deployer, buyer1, buyer2] = await ethers.getSigners();
    console.log("Buying tokens with accounts:");
    console.log("Buyer 1:", buyer1.address);
    console.log("Buyer 2:", buyer2.address);

    // Use the contracts deployed by local-deploy.js or from .env
    // You can update these addresses after running local-deploy.js
    const saleContractAddress = process.env.SALE_CONTRACT_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const tokenAddress = process.env.TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log("Sale contract address:", saleContractAddress);
    console.log("Token address:", tokenAddress);

    // Connect to the deployed contracts
    const Sale = await ethers.getContractFactory("Sale");
    const saleContract = await Sale.attach(saleContractAddress);

    const TestToken = await ethers.getContractFactory("TestToken");
    const tokenContract = await TestToken.attach(tokenAddress);

    // Deploy a new presale just for this simulation
    console.log("\n--- Creating a new presale for testing ---");
    const tokenPrice = ethers.utils.parseUnits("0.01", 6); // $0.01 per token in USDT (6 decimals)
    const nextStagePrice = ethers.utils.parseUnits("0.02", 6); // $0.02 per token in next stage
    const tokensToSell = ethers.utils.parseUnits("10000000", 18); // 10 million tokens
    const usdtHardcap = ethers.utils.parseUnits("100000", 6); // $100,000 hardcap

    await saleContract.createPresale(
        tokenPrice,
        nextStagePrice,
        tokensToSell,
        usdtHardcap
    );
    console.log("New presale created!");

    // Get current presale ID
    const presaleId = await saleContract.presaleId();
    console.log(`Current presale ID: ${presaleId}`);

    // Start the presale
    await saleContract.startPresale();
    console.log("Presale started!");

    console.log("\n--- Preparing for token purchases ---");
    // First, transfer some tokens to the buyers to simulate them having USDT
    const tokenAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT

    console.log(`Transferring ${ethers.utils.formatUnits(tokenAmount, 18)} tokens to Buyer 1`);
    await tokenContract.transfer(buyer1.address, tokenAmount);

    console.log(`Transferring ${ethers.utils.formatUnits(tokenAmount, 18)} tokens to Buyer 2`);
    await tokenContract.transfer(buyer2.address, tokenAmount);

    // Approve the Sale contract to spend tokens on behalf of buyers
    console.log("\n--- Approving token spending ---");
    const buyerTokenContract1 = tokenContract.connect(buyer1);
    await buyerTokenContract1.approve(saleContractAddress, tokenAmount);
    console.log(`Buyer 1 approved ${ethers.utils.formatUnits(tokenAmount, 18)} tokens for sale contract`);

    const buyerTokenContract2 = tokenContract.connect(buyer2);
    await buyerTokenContract2.approve(saleContractAddress, tokenAmount);
    console.log(`Buyer 2 approved ${ethers.utils.formatUnits(tokenAmount, 18)} tokens for sale contract`);

    // Buy tokens with USDT with and without referral
    console.log("\n--- Buying tokens ---");

    // Buyer 1 buys without referral and without staking
    console.log("Buyer 1 purchasing tokens without referral, no staking");
    const buyerSaleContract1 = saleContract.connect(buyer1);
    const usdtAmount1 = ethers.utils.parseUnits("100", 18); // 100 USDT
    const tx1 = await buyerSaleContract1.buyWithUSDT(usdtAmount1, ethers.constants.AddressZero, false);
    await tx1.wait();
    console.log("Purchase successful!");

    // Check how many tokens buyer 1 will be able to claim
    const presaleData1 = await saleContract.userClaimData(buyer1.address, presaleId);
    console.log(`Buyer 1 can claim ${ethers.utils.formatUnits(presaleData1.totalAmount, 18)} tokens when claiming is enabled`);

    // Buyer 2 buys with referral from buyer 1 and with staking
    console.log("\nBuyer 2 purchasing tokens with referral to Buyer 1, with staking");
    const buyerSaleContract2 = saleContract.connect(buyer2);
    const usdtAmount2 = ethers.utils.parseUnits("200", 18); // 200 USDT

    try {
        const tx2 = await buyerSaleContract2.buyWithUSDT(usdtAmount2, buyer1.address, true);
        await tx2.wait();
        console.log("Purchase with staking successful!");
    } catch (error) {
        console.error("Error during purchase with referral:", error.message);
        console.log("Attempting purchase without referral instead...");

        const tx2Fallback = await buyerSaleContract2.buyWithUSDT(usdtAmount2, ethers.constants.AddressZero, true);
        await tx2Fallback.wait();
        console.log("Purchase with staking (no referral) successful!");
    }

    // Check staking info for buyer 2
    const stakeInfo = await saleContract.getUserStakingInfo(buyer2.address);
    console.log(`\nBuyer 2 staking info:`);
    console.log(`Staked amount: ${ethers.utils.formatUnits(stakeInfo.stakedAmount, 18)} tokens`);
    console.log(`Potential reward: ${ethers.utils.formatUnits(stakeInfo.potentialReward, 18)} tokens`);
    console.log(`Total claimable: ${ethers.utils.formatUnits(stakeInfo.totalClaimable, 18)} tokens`);

    // Enable claiming for the presale
    console.log("\n--- Enabling token claiming ---");
    await saleContract.enableClaim(presaleId, true);
    console.log("Claiming enabled for presale ID:", presaleId);

    // Buyer 1 claims their tokens
    console.log("\n--- Buyer 1 claiming tokens ---");
    await buyerSaleContract1.claimAmount(presaleId);
    console.log("Claim successful!");

    // Check buyer 1's token balance
    const buyer1Balance = await tokenContract.balanceOf(buyer1.address);
    console.log(`Buyer 1 token balance: ${ethers.utils.formatUnits(buyer1Balance, 18)} tokens`);

    console.log("\n--- Summary ---");
    console.log("1. Presale created and started successfully");
    console.log("2. Buyer 1 purchased tokens without referral or staking");
    console.log("3. Buyer 2 purchased tokens with staking");
    console.log("4. Buyer 1 claimed their tokens successfully");
    console.log("5. Buyer 2's tokens are staked for 365 days with 200% APY");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 