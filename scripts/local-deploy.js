const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Step 1: Deploy a test ERC20 token for both token and USDT
    console.log("\n--- Deploying Test Token ---");
    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const tokenDecimals = 18;
    const totalSupply = ethers.utils.parseUnits("100000000000", tokenDecimals); // 100 billion tokens

    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(tokenName, tokenSymbol, totalSupply);
    await testToken.deployed();
    console.log("Test Token deployed to:", testToken.address);
    console.log("Total supply:", ethers.utils.formatUnits(totalSupply, tokenDecimals));

    // Step 2: Set up a mock price feed for local testing
    console.log("\n--- Deploying Mock Oracle ---");
    const MockOracle = await ethers.getContractFactory("MockAggregator");
    const mockOracle = await MockOracle.deploy();
    await mockOracle.deployed();
    console.log("Mock Oracle deployed to:", mockOracle.address);

    // Step 3: Deploy the Sale contract
    console.log("\n--- Deploying Sale Contract ---");
    const minTokenToBuy = ethers.utils.parseUnits("10", tokenDecimals); // 10 tokens minimum purchase

    const Sale = await ethers.getContractFactory("Sale");
    const sale = await Sale.deploy(
        mockOracle.address,
        testToken.address,  // USDT address (using test token)
        testToken.address,  // Sale token address (using test token)
        minTokenToBuy,
        totalSupply
    );
    await sale.deployed();
    console.log("Sale contract deployed to:", sale.address);

    // Step 4: Calculate and display token allocations
    const presaleTokens = await sale.presaleTokens();
    const maxReferralRewards = await sale.maxReferralRewards();
    const maxStakingRewards = await sale.maxStakingRewards();
    const totalRequired = presaleTokens.add(maxReferralRewards).add(maxStakingRewards);

    console.log("\n--- Token Allocations to Transfer to the Contract ---");
    console.log(`Presale Allocation (30%): ${ethers.utils.formatUnits(presaleTokens, tokenDecimals)} tokens`);
    console.log(`Referral Allocation (5%): ${ethers.utils.formatUnits(maxReferralRewards, tokenDecimals)} tokens`);
    console.log(`Staking Allocation (20%): ${ethers.utils.formatUnits(maxStakingRewards, tokenDecimals)} tokens`);
    console.log(`Total Required (55%): ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens`);

    // Step 5: Transfer tokens to the Sale contract
    console.log("\n--- Transferring Tokens to Sale Contract ---");
    const tx = await testToken.transfer(sale.address, totalRequired);
    await tx.wait();
    console.log(`Transferred ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens to the contract`);

    // Step 6: Verify the token balance
    const contractBalance = await testToken.balanceOf(sale.address);
    console.log(`Sale contract balance: ${ethers.utils.formatUnits(contractBalance, tokenDecimals)} tokens`);

    if (contractBalance.gte(totalRequired)) {
        console.log("✅ Transfer successful");

        // Step 7: Call preFundContract
        console.log("\n--- Calling preFundContract ---");
        const preFundTx = await sale.preFundContract();
        await preFundTx.wait();
        console.log("✅ preFundContract call successful!");

        // Step 8: Create a presale
        console.log("\n--- Creating a Presale ---");
        const tokenPrice = ethers.utils.parseUnits("0.01", 6); // $0.01 per token in USDT (6 decimals)
        const nextStagePrice = ethers.utils.parseUnits("0.02", 6); // $0.02 per token in next stage
        const tokensToSell = ethers.utils.parseUnits("1000000", tokenDecimals); // 1 million tokens
        const usdtHardcap = ethers.utils.parseUnits("10000", 6); // $10,000 hardcap

        const createPresaleTx = await sale.createPresale(
            tokenPrice,
            nextStagePrice,
            tokensToSell,
            usdtHardcap
        );
        await createPresaleTx.wait();
        console.log("✅ Presale created successfully!");

        // Step 9: Start the presale
        console.log("\n--- Starting the Presale ---");
        const startPresaleTx = await sale.startPresale();
        await startPresaleTx.wait();
        console.log("✅ Presale started successfully!");

        // Step 10: Print summary
        console.log("\n--- Deployment Summary ---");
        console.log("Test Token address:", testToken.address);
        console.log("Mock Oracle address:", mockOracle.address);
        console.log("Sale contract address:", sale.address);
        console.log("Presale is now active and ready for testing!");
    } else {
        console.log("❌ Transfer failed - not enough tokens transferred to the contract");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 