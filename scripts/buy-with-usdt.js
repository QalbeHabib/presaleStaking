const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Constants - Replace these with your actual addresses on Sepolia
const SALE_CONTRACT_ADDRESS = "0xB759b0e893091a24c96907cCf6684664157e8401"; // Replace with actual Sale contract address
const USDT_TOKEN_ADDRESS = "0x1679B569c112C40fE04BA89C99D59326De278620"; // Replace with actual USDT token address on Sepolia

// Load the full ABIs from artifacts
// This is better than using hardcoded fragments as it includes all functions
const SALE_ARTIFACT_PATH = path.join(__dirname, "../artifacts/contracts/Sale.sol/Sale.json");
const SALE_ARTIFACT = JSON.parse(fs.readFileSync(SALE_ARTIFACT_PATH, "utf8"));
const SALE_ABI = SALE_ARTIFACT.abi;

// For USDT, we'll define a standard ERC20 ABI since it's not part of our local artifacts
// You could also load from a standard ERC20 artifact if available
const USDT_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
];

async function main() {
    // Get the Infura API key from environment variables
    // Environment variables are already loaded by direnv from .envrc
    const infuraApiKey = process.env.INFURA_API_KEY;
    if (!infuraApiKey) {
        console.error("INFURA_API_KEY is not defined in .envrc file");
        process.exit(1);
    }

    // Create Infura provider for Sepolia
    const provider = new ethers.providers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/${infuraApiKey}`
    );

    // Get private key from environment variables
    const privateKey = process.env.PRIVATE_KEY || process.env.HDWALLET_MNEMONIC?.split(' ')[0];
    if (!privateKey) {
        console.error("Neither PRIVATE_KEY nor HDWALLET_MNEMONIC is defined in .envrc file");
        process.exit(1);
    }

    // Set up signer using private key
    const signer = new ethers.Wallet(privateKey, provider);
    console.log("Using address:", signer.address);

    // Check account balance
    const balance = await provider.getBalance(signer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    try {
        // Create contract instances
        const usdtContract = new ethers.Contract(USDT_TOKEN_ADDRESS, USDT_ABI, signer);
        const saleContract = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_ABI, signer);

        // Get USDT decimals
        const usdtDecimals = await usdtContract.decimals();
        console.log(`USDT decimals: ${usdtDecimals}`);

        // Check USDT balance
        const usdtBalance = await usdtContract.balanceOf(signer.address);
        console.log(`USDT Balance: ${ethers.utils.formatUnits(usdtBalance, usdtDecimals)}`);

        // Get current presale ID
        const presaleId = await saleContract.presaleId();
        console.log(`Current presale ID: ${presaleId}`);

        // Get the minimum token requirement
        const minTokenToBuy = await saleContract.MinTokenTobuy();
        console.log(`Minimum token requirement: ${ethers.utils.formatEther(minTokenToBuy)} tokens`);

        // Get token price from presale mapping directly instead of using getPresaleInfo
        console.log("Getting presale data from the contract...");
        const presaleData = await saleContract.presale(presaleId);
        const tokenPrice = presaleData.price;
        console.log(`Token price: ${ethers.utils.formatUnits(tokenPrice, usdtDecimals)} USDT`);

        // Check remaining hardcap
        const hardcap = presaleData.UsdtHardcap;
        const amountRaised = presaleData.amountRaised;
        const remainingHardcap = hardcap.sub(amountRaised);
        console.log(`USDT Hardcap: ${ethers.utils.formatUnits(hardcap, usdtDecimals)}`);
        console.log(`Amount raised: ${ethers.utils.formatUnits(amountRaised, usdtDecimals)}`);
        console.log(`Remaining hardcap: ${ethers.utils.formatUnits(remainingHardcap, usdtDecimals)}`);

        // Calculate minimum USDT needed using the formula directly
        let minUsdtNeeded = minTokenToBuy.mul(tokenPrice).div(ethers.utils.parseEther("1")).mul(105).div(100);
        console.log(`You need at least ${ethers.utils.formatUnits(minUsdtNeeded, usdtDecimals)} USDT to meet the minimum token requirement`);

        // Check if the minimum amount exceeds the remaining hardcap
        if (minUsdtNeeded.gt(remainingHardcap)) {
            console.error(`\nERROR: The minimum required USDT (${ethers.utils.formatUnits(minUsdtNeeded, usdtDecimals)}) exceeds the remaining hardcap (${ethers.utils.formatUnits(remainingHardcap, usdtDecimals)})`);
            console.log("\nOptions:");
            console.log("1. Contact the contract owner to increase the hardcap");
            console.log("2. Contact the contract owner to exclude your address from the minimum token requirement");
            console.log("3. Wait for the next presale stage");

            // Calculate max tokens possible with remaining hardcap
            const maxPossibleTokens = remainingHardcap.mul(ethers.utils.parseEther("1")).div(tokenPrice);
            console.log(`\nMaximum tokens you can buy with remaining hardcap: ${ethers.utils.formatEther(maxPossibleTokens)}`);

            if (!isExcluded) {
                console.log("\nSince you're not excluded from minimum requirements and can't meet them, stopping.");
                process.exit(1);
            } else {
                console.log("\nYou're excluded from minimum requirements, adjusting to use remaining hardcap.");
                minUsdtNeeded = remainingHardcap;
            }
        }

        // Double-check by calculating estimated tokens for this USDT amount
        try {
            const estimatedTokens = await saleContract.usdtToTokens(presaleId, minUsdtNeeded);
            console.log(`This will give you approximately ${ethers.utils.formatEther(estimatedTokens)} tokens`);

            // Verify we're meeting minimum requirement
            if (estimatedTokens.lt(minTokenToBuy)) {
                console.warn(`WARNING: Still not meeting minimum token requirement. Increasing USDT amount by 10% more.`);
                minUsdtNeeded = minUsdtNeeded.mul(110).div(100);
                console.log(`New USDT amount: ${ethers.utils.formatUnits(minUsdtNeeded, usdtDecimals)}`);
            }
        } catch (error) {
            console.warn(`Warning: Couldn't estimate tokens using usdtToTokens function. Using calculated amount instead.`);
            console.log(`If the transaction fails, you might need to adjust the USDT amount manually.`);
        }

        // Set USDT amount with a reasonable buffer above the minimum, but within hardcap
        let usdtAmount = minUsdtNeeded;

        // Ensure it doesn't exceed the hardcap
        if (usdtAmount.gt(remainingHardcap)) {
            console.log(`Reducing USDT amount to fit within remaining hardcap`);
            usdtAmount = remainingHardcap;
        }

        console.log(`Using ${ethers.utils.formatUnits(usdtAmount, usdtDecimals)} USDT for the purchase`);

        // Make sure we have enough USDT
        if (usdtBalance.lt(usdtAmount)) {
            console.error(`Insufficient USDT balance. Have ${ethers.utils.formatUnits(usdtBalance, usdtDecimals)}, need ${ethers.utils.formatUnits(usdtAmount, usdtDecimals)}`);
            return;
        }

        // Check if the account is excluded from minimum token check
        const isExcluded = await saleContract.isExcludeMinToken(signer.address);
        console.log(`Is your address excluded from minimum token requirement? ${isExcluded}`);

        // Approve USDT spending
        console.log(`Approving ${ethers.utils.formatUnits(usdtAmount, usdtDecimals)} USDT for sale contract...`);
        const approveTx = await usdtContract.approve(SALE_CONTRACT_ADDRESS, usdtAmount);
        console.log(`Approve transaction hash: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("USDT approved successfully");

        // Buy tokens with USDT (with staking)
        const stakeTokens = true; // Set to true if you want to stake tokens, false otherwise
        console.log(`\nBuying tokens with ${ethers.utils.formatUnits(usdtAmount, usdtDecimals)} USDT (with staking: ${stakeTokens})...`);

        try {
            // Try a static call first to see if it would revert and why
            console.log("Performing static call to check for potential errors...");
            try {
                await saleContract.callStatic.buyWithUSDT(
                    usdtAmount,
                    ethers.constants.AddressZero,
                    stakeTokens
                );
                console.log("Static call successful, transaction should work.");
            } catch (staticError) {
                console.error("Static call failed with reason:", staticError.reason || staticError.message);

                // If error is about the minimum token requirement and we're not excluded, show a helpful message
                if ((staticError.reason || staticError.message).includes("Less than min") && !isExcluded) {
                    console.log("\nNOTE: You need to be excluded from the minimum token requirement or increase your USDT amount.");
                    console.log("Only the contract owner can exclude your address.");
                    console.log("Contact the contract owner to request exclusion for your address:");
                    console.log(signer.address);

                    // Additional diagnostics - get more info about the presale
                    try {
                        console.log("\nPresale details:");
                        const presaleData = await saleContract.presale(presaleId);
                        console.log(`- Price: ${ethers.utils.formatUnits(presaleData.price, usdtDecimals)} USDT`);
                        console.log(`- Tokens to sell: ${ethers.utils.formatEther(presaleData.tokensToSell)}`);
                        console.log(`- Tokens sold: ${ethers.utils.formatEther(presaleData.Sold)}`);
                        console.log(`- USDT hardcap: ${ethers.utils.formatUnits(presaleData.UsdtHardcap, usdtDecimals)}`);
                        console.log(`- USDT raised: ${ethers.utils.formatUnits(presaleData.amountRaised, usdtDecimals)}`);
                        console.log(`- Is active: ${presaleData.Active}`);
                        console.log(`- Claiming enabled: ${presaleData.isEnableClaim}`);
                    } catch (error) {
                        console.error("Could not retrieve presale details:", error.message);
                    }

                    return; // Don't proceed with the actual transaction
                } else if ((staticError.reason || staticError.message).includes("Presale is not active")) {
                    // Check if presale is active directly from presale mapping
                    try {
                        const presaleData = await saleContract.presale(presaleId);
                        console.log("\nPresale is not active. Current status:");
                        console.log(`- Is active: ${presaleData.Active}`);
                        console.log("Contact the contract owner to activate the presale.");
                    } catch (error) {
                        console.error("Could not check presale status:", error.message);
                    }
                    return; // Don't proceed
                }

                console.log("Attempting actual transaction despite static call failure...");
            }

            // Set gas limit manually to avoid estimation errors
            const buyTx = await saleContract.buyWithUSDT(
                usdtAmount,
                ethers.constants.AddressZero, // No referrer
                stakeTokens,
                {
                    gasLimit: 500000, // Set a manual gas limit
                }
            );

            console.log(`Buy transaction hash: ${buyTx.hash}`);
            const receipt = await buyTx.wait();
            console.log("Token purchase successful!");
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);

            // If staking was successful, show staking information
            if (stakeTokens) {
                try {
                    const stakingInfo = await saleContract.getUserStakingInfo(signer.address);
                    console.log("\nStaking Information:");
                    console.log(`Staked amount: ${ethers.utils.formatEther(stakingInfo.stakedAmount)}`);
                    console.log(`Unlock time: ${new Date(stakingInfo.unlockTime.toNumber() * 1000).toISOString()}`);
                    console.log(`Is locked: ${stakingInfo.isLocked}`);
                    console.log(`Potential reward: ${ethers.utils.formatEther(stakingInfo.potentialReward)}`);
                    console.log(`Total claimable after lock period: ${ethers.utils.formatEther(stakingInfo.totalClaimable)}`);
                } catch (error) {
                    console.error("Failed to fetch staking information:", error.message);
                }
            }
        } catch (error) {
            console.error("Transaction error details:");
            if (error.error) {
                console.error(error.error.message);
            } else {
                console.error(error.message);
            }
        }

    } catch (error) {
        console.error("Error executing transaction:");
        console.error(error.reason || error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 