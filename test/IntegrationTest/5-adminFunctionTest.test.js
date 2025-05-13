const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    getBalances
} = require("./helpers/integrationHelper");

describe("Admin Function Integration Tests", function () {
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

    describe("Admin Operations", function () {
        it("should allow admin to pause and unpause the contract", async function () {
            // Pause the contract
            await contracts.saleContract.pause();
            expect(await contracts.saleContract.paused()).to.be.true;

            // Try to buy tokens while paused (should fail)
            const purchaseAmount = ethers.utils.parseUnits("1000", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );
            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                purchaseAmount,
                wallets.buyer1Wallet
            );
            await expect(
                buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, wallets.buyer1Wallet)
            ).to.be.revertedWith("Pausable: paused");

            // Unpause the contract
            await contracts.saleContract.unpause();
            expect(await contracts.saleContract.paused()).to.be.false;

            // Verify buying works again
            await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, wallets.buyer1Wallet);
        });

        it("should allow admin to update token price", async function () {
            const newPrice = ethers.utils.parseUnits("0.02", 18);
            
            // Update price
            await contracts.saleContract.updateTokenPrice(newPrice);
            
            // Verify new price
            const currentPrice = await contracts.saleContract.getCurrentPrice();
            expect(currentPrice).to.equal(newPrice);

            // Verify buying works with new price
            const purchaseAmount = ethers.utils.parseUnits("1000", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer2Wallet
            );
            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                purchaseAmount,
                wallets.buyer2Wallet
            );
            await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, wallets.buyer2Wallet);
        });

        it("should allow admin to update staking parameters", async function () {
            const newStakingRate = 1000; // 10% APY
            const newStakingPeriod = 30 * 24 * 60 * 60; // 30 days

            // Update staking parameters
            await contracts.saleContract.updateStakingParameters(newStakingRate, newStakingPeriod);

            // Verify new parameters
            const stakingInfo = await contracts.saleContract.getStakingInfo(wallets.buyer1Wallet.address);
            expect(stakingInfo.stakingRate).to.equal(newStakingRate);
            expect(stakingInfo.stakingPeriod).to.equal(newStakingPeriod);
        });

        it("should allow admin to update referral parameters", async function () {
            const newReferralRate = 500; // 5%

            // Update referral rate
            await contracts.saleContract.updateReferralRate(newReferralRate);

            // Verify new rate
            const referralRate = await contracts.saleContract.getReferralRate();
            expect(referralRate).to.equal(newReferralRate);

            // Test referral with new rate
            const purchaseAmount = ethers.utils.parseUnits("1000", 18);
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer3Wallet
            );
            await approveUSDT(
                buyerContracts.usdtContract,
                saleAddress,
                purchaseAmount,
                wallets.buyer3Wallet
            );
            await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, wallets.buyer3Wallet);
        });

        it("should allow admin to withdraw funds", async function () {
            // First, let's have some users make purchases to accumulate funds
            const purchaseAmount = ethers.utils.parseUnits("1000", 18);
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                await approveUSDT(
                    buyerContracts.usdtContract,
                    saleAddress,
                    purchaseAmount,
                    buyerWallet
                );
                await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, buyerWallet);
            }

            // Get initial admin balance
            const initialBalance = await getBalances(
                contracts.tokenContract,
                contracts.usdtContract,
                wallets.adminWallet.address
            );

            // Withdraw funds
            await contracts.saleContract.withdrawFunds();

            // Verify admin received funds
            const finalBalance = await getBalances(
                contracts.tokenContract,
                contracts.usdtContract,
                wallets.adminWallet.address
            );
            expect(finalBalance.usdtBalance).to.be.gt(initialBalance.usdtBalance);
        });

        it("should prevent non-admin from calling admin functions", async function () {
            const buyerContracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );

            // Try to call admin functions as non-admin
            await expect(
                buyerContracts.saleContract.pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                buyerContracts.saleContract.updateTokenPrice(ethers.utils.parseUnits("0.02", 18))
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                buyerContracts.saleContract.updateStakingParameters(1000, 30 * 24 * 60 * 60)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                buyerContracts.saleContract.updateReferralRate(500)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                buyerContracts.saleContract.withdrawFunds()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
}); 