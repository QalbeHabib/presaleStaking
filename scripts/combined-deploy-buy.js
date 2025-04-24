const { ethers } = require("hardhat");

async function main() {
    const [deployer, buyer1, buyer2] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Buyers:", buyer1.address, buyer2.address);

    // Step 1: Deploy a test ERC20 token for the sale token
    console.log("\n--- Deploying Test Sale Token ---");
    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const tokenDecimals = 18;
    const totalSupply = ethers.utils.parseUnits("100000000000", tokenDecimals); // 100 billion tokens

    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(tokenName, tokenSymbol, totalSupply);
    await testToken.deployed();
    console.log("Test Sale Token deployed to:", testToken.address);
    console.log("Total supply:", ethers.utils.formatUnits(totalSupply, tokenDecimals));

    // Step 1.5: Deploy a test USDT token with 6 decimals
    console.log("\n--- Deploying Test USDT Token ---");
    const usdtName = "Test USDT";
    const usdtSymbol = "TUSDT";
    const usdtDecimals = 6; // USDT has 6 decimals
    const usdtTotalSupply = ethers.utils.parseUnits("10000000", usdtDecimals); // 10 million USDT

    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const testUSDT = await TestUSDT.deploy(usdtName, usdtSymbol, usdtTotalSupply);
    await testUSDT.deployed();
    console.log("Test USDT Token deployed to:", testUSDT.address);
    console.log("Total USDT supply:", ethers.utils.formatUnits(usdtTotalSupply, usdtDecimals));

    // Step 2: Set up a mock price feed for local testing
    console.log("\n--- Deploying Mock Oracle ---");
    const MockOracle = await ethers.getContractFactory("MockAggregator");
    const mockOracle = await MockOracle.deploy();
    await mockOracle.deployed();
    console.log("Mock Oracle deployed to:", mockOracle.address);

    // Step 3: Deploy the Sale contract
    console.log("\n--- Deploying Sale Contract ---");
    // Setting minimum token to buy lower to avoid issues
    const minTokenToBuy = ethers.utils.parseUnits("10", tokenDecimals); // 10 tokens minimum purchase

    const Sale = await ethers.getContractFactory("Sale");
    const saleContract = await Sale.deploy(
        mockOracle.address,
        testUSDT.address,  // USDT address (using test USDT token)
        testToken.address,  // Sale token address
        minTokenToBuy,
        totalSupply
    );
    await saleContract.deployed();
    console.log("Sale contract deployed to:", saleContract.address);

    // Step 4: Calculate and transfer token allocations
    const presaleTokens = await saleContract.presaleTokens();
    const maxReferralRewards = await saleContract.maxReferralRewards();
    const maxStakingRewards = await saleContract.maxStakingRewards();
    const totalRequired = presaleTokens.add(maxReferralRewards).add(maxStakingRewards);

    console.log("\n--- Token Allocations ---");
    console.log(`Presale Allocation (30%): ${ethers.utils.formatUnits(presaleTokens, tokenDecimals)} tokens`);
    console.log(`Referral Allocation (5%): ${ethers.utils.formatUnits(maxReferralRewards, tokenDecimals)} tokens`);
    console.log(`Staking Allocation (20%): ${ethers.utils.formatUnits(maxStakingRewards, tokenDecimals)} tokens`);
    console.log(`Total Required (55%): ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens`);

    console.log("\n--- Transferring Tokens to Sale Contract ---");
    const tx = await testToken.transfer(saleContract.address, totalRequired);
    await tx.wait();
    console.log(`Transferred ${ethers.utils.formatUnits(totalRequired, tokenDecimals)} tokens to the contract`);

    // Step 5: Verify the token balance
    const contractBalance = await testToken.balanceOf(saleContract.address);
    console.log(`Sale contract balance: ${ethers.utils.formatUnits(contractBalance, tokenDecimals)} tokens`);

    if (contractBalance.gte(totalRequired)) {
        console.log("✅ Transfer successful");

        // Step 6: Call preFundContract
        console.log("\n--- Calling preFundContract ---");
        const preFundTx = await saleContract.preFundContract();
        await preFundTx.wait();
        console.log("✅ preFundContract call successful!");

        // Step 7: Create a presale
        console.log("\n--- Creating a Presale ---");
        // Setting a very low token price to ensure minimum token requirements are met
        const tokenPrice = ethers.utils.parseUnits("0.001", 6); // $0.001 per token in USDT (6 decimals)
        const nextStagePrice = ethers.utils.parseUnits("0.002", 6); // $0.002 per token in next stage
        const tokensToSell = ethers.utils.parseUnits("10000000", tokenDecimals); // 10 million tokens
        const usdtHardcap = ethers.utils.parseUnits("100000", 6); // $100,000 hardcap

        const createPresaleTx = await saleContract.createPresale(
            tokenPrice,
            nextStagePrice,
            tokensToSell,
            usdtHardcap
        );
        await createPresaleTx.wait();
        console.log("✅ Presale created successfully!");

        // Step 8: Start the presale
        console.log("\n--- Starting the Presale ---");
        const startPresaleTx = await saleContract.startPresale();
        await startPresaleTx.wait();
        console.log("✅ Presale started successfully!");

        // Step 9: Prepare buyers with USDT tokens
        console.log("\n--- Preparing Buyers with USDT ---");
        const buyerAmount = ethers.utils.parseUnits("5000", 6); // 5000 USDT with 6 decimals

        await testUSDT.transfer(buyer1.address, buyerAmount);
        console.log(`Transferred ${ethers.utils.formatUnits(buyerAmount, 6)} USDT to Buyer 1`);

        await testUSDT.transfer(buyer2.address, buyerAmount);
        console.log(`Transferred ${ethers.utils.formatUnits(buyerAmount, 6)} USDT to Buyer 2`);

        // Step 10: Approve token spending
        console.log("\n--- Approving USDT Spending ---");
        const buyerUsdt1 = testUSDT.connect(buyer1);
        await buyerUsdt1.approve(saleContract.address, buyerAmount);
        console.log("Buyer 1 approved USDT for sale contract");

        const buyerUsdt2 = testUSDT.connect(buyer2);
        await buyerUsdt2.approve(saleContract.address, buyerAmount);
        console.log("Buyer 2 approved USDT for sale contract");

        // Get the presale ID
        const presaleId = await saleContract.presaleId();
        console.log("\n--- Making Purchases ---");
        console.log("Current presale ID:", presaleId.toString());

        // Get the minimum purchase amount required for referrals (1000 tokens)
        const minTokenForReferral = await saleContract.MINIMUM_PURCHASE_FOR_REFERRAL();
        console.log(`Minimum tokens required for referral: ${ethers.utils.formatUnits(minTokenForReferral, 18)}`);

        // Calculate USDT amount needed to buy at least the minimum token amount
        // tokens = usdtAmount / tokenPrice, so usdtAmount = tokens * tokenPrice
        // We need to adjust for decimals: tokens have 18 decimals, USDT has 6 decimals, price has 6 decimals
        const minUsdtForReferral = minTokenForReferral.mul(tokenPrice).div(10 ** 12); // Convert tokenPrice to 18 decimals
        console.log(`Minimum USDT needed to qualify as referrer: ${ethers.utils.formatUnits(minUsdtForReferral, 6)} USDT`);

        // Use a larger amount to ensure we exceed minimum requirements
        const usdtAmount1 = ethers.utils.parseUnits("1500", 6); // 1500 USDT

        try {
            // Buyer 1 - no referral, no staking (first purchase to qualify as referrer)
            const buyer1Contract = saleContract.connect(buyer1);
            console.log(`Buyer 1 purchasing with ${ethers.utils.formatUnits(usdtAmount1, 6)} USDT (no referral, no staking)`);

            const buyTx1 = await buyer1Contract.buyWithUSDT(usdtAmount1, ethers.constants.AddressZero, false);
            await buyTx1.wait();
            console.log("Buyer 1 purchase successful (first purchase, no referral, no staking)");

            // Check if buyer 1 has qualified as a referrer
            const canRefer = await saleContract.canReferOthers(buyer1.address);
            console.log(`Buyer 1 qualified as referrer: ${canRefer}`);

            if (canRefer) {
                // Buyer 2 - uses Buyer 1 as referrer with staking enabled
                const buyer2Contract = saleContract.connect(buyer2);
                const usdtAmount2 = ethers.utils.parseUnits("2000", 6); // 2000 USDT

                console.log(`Buyer 2 purchasing with ${ethers.utils.formatUnits(usdtAmount2, 6)} USDT (with referral to Buyer 1, with staking)`);

                const buyTx2 = await buyer2Contract.buyWithUSDT(usdtAmount2, buyer1.address, true);
                await buyTx2.wait();
                console.log("Buyer 2 purchase successful (with referral and staking)");

                // Check referral status
                const referralInfo = await saleContract.getUserReferralInfo(buyer1.address);
                console.log("\n--- Referral Status ---");
                console.log(`Buyer 1 total referral rewards: ${ethers.utils.formatUnits(referralInfo.totalRewards, 18)}`);
                console.log(`Buyer 1 referral count: ${referralInfo.referralCount.toString()}`);

                // Check referral status for buyer 2 as well
                const buyer2ReferralInfo = await saleContract.getUserReferralInfo(buyer2.address);
                console.log(`Buyer 2 referrer address: ${buyer2ReferralInfo.referrer}`);
                console.log(`Buyer 2 total referral rewards: ${ethers.utils.formatUnits(buyer2ReferralInfo.totalRewards, 18)}`);
            } else {
                // If buyer 1 didn't qualify, buyer 2 makes a purchase without referral
                console.log("Buyer 1 did not qualify as referrer. Buyer 2 will purchase without referral.");

                const buyer2Contract = saleContract.connect(buyer2);
                const usdtAmount2 = ethers.utils.parseUnits("2000", 6); // 2000 USDT

                const buyTx2 = await buyer2Contract.buyWithUSDT(usdtAmount2, ethers.constants.AddressZero, true);
                await buyTx2.wait();
                console.log("Buyer 2 purchase with staking successful (no referral)");
            }

            // Step 12: Check buyer statuses
            console.log("\n--- Buyer 1 Status (No Staking) ---");
            const buyer1ClaimData = await saleContract.userClaimData(buyer1.address, presaleId);
            console.log(`Tokens purchased: ${ethers.utils.formatUnits(buyer1ClaimData.totalAmount, 18)}`);
            console.log(`Tokens claimed: ${ethers.utils.formatUnits(buyer1ClaimData.claimedAmount, 18)}`);

            console.log("\n--- Buyer 2 Status (With Staking) ---");
            const buyer2StakeInfo = await saleContract.getUserStakingInfo(buyer2.address);
            console.log(`Staked amount: ${ethers.utils.formatUnits(buyer2StakeInfo.stakedAmount, 18)}`);
            console.log(`Potential reward (200% APY): ${ethers.utils.formatUnits(buyer2StakeInfo.potentialReward, 18)}`);
            console.log(`Total claimable after 1 year: ${ethers.utils.formatUnits(buyer2StakeInfo.totalClaimable, 18)}`);

            // Step 13: Enable claiming and let buyer 1 claim
            console.log("\n--- Enabling Token Claiming ---");
            await saleContract.enableClaim(presaleId, true);
            console.log("Claiming enabled for presale ID:", presaleId.toString());

            if (buyer1ClaimData.totalAmount.gt(0)) {
                console.log("\n--- Buyer 1 Claims Tokens ---");
                await buyer1Contract.claimAmount(presaleId);
                console.log("Buyer 1 claimed tokens successfully");

                const buyer1Balance = await testToken.balanceOf(buyer1.address);
                console.log(`Buyer 1 final token balance: ${ethers.utils.formatUnits(buyer1Balance, 18)}`);
            }

            console.log("\n--- Final Summary ---");
            console.log("1. Presale setup and pre-funded successfully");
            console.log("2. Both buyers purchased tokens");
            console.log("3. Buyer 1 claimed regular tokens");
            console.log("4. Buyer 2's tokens are staked for 1 year with 200% APY");

        } catch (error) {
            console.error("Error during purchase or claiming process:", error.message);
        }
    } else {
        console.log("❌ Transfer failed - insufficient tokens");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 