const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    stakeTokens,
    addReferral,
    getBalances
} = require("./helpers/integrationHelper");

describe("Edge Cases Integration Tests", function () {
    let provider;
    let wallets;
    let contracts;
    let saleAddress, tokenAddress, usdtAddress;

    before(async function () {
        provider = ethers.provider;
        wallets = createWallets(provider);
        
        // Deploy contracts (assuming they're already deployed and addresses are known)
        saleAddress = "0xDB6aD590d10143123012dD0a3fffeF7AC2f92F9E";
        tokenAddress = "0x8f55e31c026Dc225e3497BE3B6B8f8A5123155CC";
        usdtAddress = "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f";

        // Get contract instances for admin
        contracts = await getContractInstances(
            saleAddress,
            tokenAddress,
            usdtAddress,
            wallets.adminWallet
        );
    });

    describe("Edge Cases", function () {
        it("should handle maximum token purchase limits", async function () {
            const maxPurchaseAmount = ethers.utils.parseUnits("1000000", 18); // 1M USDT
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // Try to purchase more than the maximum allowed
            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                maxPurchaseAmount,
                wallets.buyer1Wallet
            );
            await expect(
                buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, maxPurchaseAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Purchase amount exceeds maximum limit");
        });

        it("should handle minimum token purchase limits", async function () {
            const minPurchaseAmount = ethers.utils.parseUnits("0.0001", 18); // Very small amount
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // Try to purchase less than the minimum allowed
            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                minPurchaseAmount,
                wallets.buyer1Wallet
            );
            await expect(
                buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, minPurchaseAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Purchase amount below minimum limit");
        });

        it("should handle staking with zero amount", async function () {
            const zeroAmount = ethers.utils.parseUnits("0", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await expect(
                stakeTokens(buyerContracts.saleContract, zeroAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Cannot stake zero tokens");
        });

        it("should handle staking with insufficient balance", async function () {
            const largeAmount = ethers.utils.parseUnits("1000000", 18); // 1M tokens
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await expect(
                stakeTokens(buyerContracts.saleContract, largeAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Insufficient token balance");
        });

        it("should handle double staking attempts", async function () {
            const stakeAmount = ethers.utils.parseUnits("1000", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // First stake
            await stakeTokens(buyerContracts.saleContract, stakeAmount, wallets.buyer1Wallet);

            // Try to stake again
            await expect(
                stakeTokens(buyerContracts.saleContract, stakeAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Already staking");
        });

        it("should handle self-referral attempts", async function () {
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await expect(
                addReferral(buyerContracts.saleContract, wallets.buyer1Wallet.address, wallets.buyer1Wallet)
            ).to.be.revertedWith("Cannot refer yourself");
        });

        it("should handle referral to non-existent address", async function () {
            const nonExistentAddress = "0x0000000000000000000000000000000000000000";
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await expect(
                addReferral(buyerContracts.saleContract, nonExistentAddress, wallets.buyer1Wallet)
            ).to.be.revertedWith("Invalid referrer address");
        });

        it("should handle purchase with insufficient USDT balance", async function () {
            const largeAmount = ethers.utils.parseUnits("1000000", 18); // 1M USDT
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                largeAmount,
                wallets.buyer1Wallet
            );
            await expect(
                buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, largeAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Insufficient USDT balance");
        });

        it("should handle purchase with insufficient token supply", async function () {
            // First, let's try to buy a very large amount that would exceed the token supply
            const hugeAmount = ethers.utils.parseUnits("1000000000", 18); // 1B USDT
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                hugeAmount,
                wallets.buyer1Wallet
            );
            await expect(
                buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, hugeAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Insufficient token supply");
        });

        it("should handle unstaking before minimum staking period", async function () {
            const stakeAmount = ethers.utils.parseUnits("1000", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // Stake tokens
            await stakeTokens(buyerContracts.saleContract, stakeAmount, wallets.buyer1Wallet);

            // Try to unstake immediately
            await expect(
                buyerContracts.saleContract.unstakeTokens()
            ).to.be.revertedWith("Minimum staking period not met");
        });

        it("should handle multiple referral attempts", async function () {
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // First referral
            await addReferral(buyerContracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);

            // Try to change referral
            await expect(
                addReferral(buyerContracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer1Wallet)
            ).to.be.revertedWith("Referral already set");
        });
    });
}); 