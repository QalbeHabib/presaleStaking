const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    addReferral,
    getBalances
} = require("./helpers/integrationHelper");

describe("Referral Integration Tests", function () {
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

    describe("Referral System Integration", function () {
        it("should handle multiple referral relationships correctly", async function () {
            // Set up referral relationships
            // Buyer2 refers Buyer1
            // Buyer3 refers Buyer2
            // Buyer4 refers Buyer3

            // Add referrals
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            await addReferral(contracts.saleContract, wallets.buyer4Wallet.address, wallets.buyer3Wallet);

            // Verify referral relationships
            const buyer1Referrer = await contracts.saleContract.getReferrer(wallets.buyer1Wallet.address);
            const buyer2Referrer = await contracts.saleContract.getReferrer(wallets.buyer2Wallet.address);
            const buyer3Referrer = await contracts.saleContract.getReferrer(wallets.buyer3Wallet.address);

            expect(buyer1Referrer).to.equal(wallets.buyer2Wallet.address);
            expect(buyer2Referrer).to.equal(wallets.buyer3Wallet.address);
            expect(buyer3Referrer).to.equal(wallets.buyer4Wallet.address);
        });

        it("should distribute referral rewards correctly", async function () {
            const purchaseAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT

            // Get initial balances
            const initialBalances = {};
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                initialBalances[`buyer${i}`] = await getBalances(
                    buyerContracts.tokenContract,
                    buyerContracts.usdtContract,
                    buyerWallet.address
                );
            }

            // Set up referral chain
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            await addReferral(contracts.saleContract, wallets.buyer4Wallet.address, wallets.buyer3Wallet);

            // Buyer1 makes a purchase
            const buyer1Contracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer1Wallet
            );
            await approveUSDT(
                buyer1Contracts.usdtContract,
                saleAddress,
                purchaseAmount,
                wallets.buyer1Wallet
            );
            await buyTokens(buyer1Contracts.saleContract, buyer1Contracts.usdtContract, purchaseAmount, wallets.buyer1Wallet);

            // Verify referral rewards
            const buyer2Contracts = await getContractInstances(
                saleAddress,
                tokenAddress,
                usdtAddress,
                wallets.buyer2Wallet
            );
            const buyer2FinalBalance = await getBalances(
                buyer2Contracts.tokenContract,
                buyer2Contracts.usdtContract,
                wallets.buyer2Wallet.address
            );

            // Buyer2 should have received referral rewards
            expect(buyer2FinalBalance.tokenBalance).to.be.gt(initialBalances.buyer2.tokenBalance);
        });

        it("should handle multiple purchases with referrals", async function () {
            const purchaseAmount = ethers.utils.parseUnits("500", 18); // 500 USDT

            // Set up referral relationships
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            await addReferral(contracts.saleContract, wallets.buyer4Wallet.address, wallets.buyer3Wallet);

            // Get initial balances
            const initialBalances = {};
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                initialBalances[`buyer${i}`] = await getBalances(
                    buyerContracts.tokenContract,
                    buyerContracts.usdtContract,
                    buyerWallet.address
                );
            }

            // All buyers make purchases
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

            // Verify final balances and rewards
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const finalBalances = await getBalances(
                    buyerContracts.tokenContract,
                    buyerContracts.usdtContract,
                    buyerWallet.address
                );

                // All buyers should have more tokens than initial balance
                expect(finalBalances.tokenBalance).to.be.gt(initialBalances[`buyer${i}`].tokenBalance);
            }
        });

        it("should prevent circular referrals", async function () {
            // Try to create circular referrals
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            
            // This should fail as it would create a circle
            await expect(
                addReferral(contracts.saleContract, wallets.buyer1Wallet.address, wallets.buyer3Wallet)
            ).to.be.revertedWith("Circular referral not allowed");
        });
    });
}); 