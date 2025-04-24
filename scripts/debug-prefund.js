const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking with the account:", deployer.address);

    // Get your deployed contract address - replace with your actual address
    const saleContractAddress = process.env.SALE_CONTRACT_ADDRESS || "YOUR_DEPLOYED_CONTRACT_ADDRESS";
    console.log("Sale contract address:", saleContractAddress);

    // Connect to the deployed Sale contract
    const Sale = await ethers.getContractFactory("Sale");
    const saleContract = await Sale.attach(saleContractAddress);

    try {
        // Get the token address
        const saleToken = await saleContract.SaleToken();
        console.log("Sale Token Address:", saleToken);

        // Get the required allocations
        const totalSupply = await saleContract.totalTokenSupply();
        const presaleTokens = await saleContract.presaleTokens();
        const maxReferralRewards = await saleContract.maxReferralRewards();
        const maxStakingRewards = await saleContract.maxStakingRewards();

        // Calculate the total required
        const totalRequired = presaleTokens.add(maxReferralRewards).add(maxStakingRewards);

        // Create a simple ERC20 interface for the token
        const tokenContract = new ethers.Contract(
            saleToken,
            ["function balanceOf(address owner) view returns (uint256)"],
            deployer
        );

        // Check contract's token balance
        const contractBalance = await tokenContract.balanceOf(saleContractAddress);

        console.log("\n--- Token Allocations and Balance ---");
        console.log(`Total Supply: ${ethers.utils.formatUnits(totalSupply, 18)} tokens`);
        console.log(`Presale Allocation (30%): ${ethers.utils.formatUnits(presaleTokens, 18)} tokens`);
        console.log(`Referral Allocation (5%): ${ethers.utils.formatUnits(maxReferralRewards, 18)} tokens`);
        console.log(`Staking Allocation (20%): ${ethers.utils.formatUnits(maxStakingRewards, 18)} tokens`);
        console.log(`Total Required (55%): ${ethers.utils.formatUnits(totalRequired, 18)} tokens`);
        console.log(`Contract Balance: ${ethers.utils.formatUnits(contractBalance, 18)} tokens`);

        if (contractBalance.lt(totalRequired)) {
            const deficit = totalRequired.sub(contractBalance);
            console.log(`\n❌ INSUFFICIENT BALANCE: The contract needs more tokens`);
            console.log(`You need to transfer at least ${ethers.utils.formatUnits(deficit, 18)} more tokens to the contract`);
        } else {
            console.log("\n✅ SUFFICIENT BALANCE: You have enough tokens to call preFundContract()");
        }

    } catch (error) {
        console.error("Error occurred:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 