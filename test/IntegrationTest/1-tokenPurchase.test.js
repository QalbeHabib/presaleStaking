const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    getBalances
} = require("./helpers/integrationHelper");

describe("Token Purchase Integration Tests", function () {
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

    describe("Multiple Buyers Token Purchase", function () {
        it("should allow multiple buyers to purchase tokens", async function () {
            const purchaseAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT

            // Approve USDT spending for all buyers
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
            }

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

            // Execute purchases
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, buyerWallet);
            }

            // Verify final balances
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

                // Verify token balance increased
                expect(finalBalances.tokenBalance).to.be.gt(initialBalances[`buyer${i}`].tokenBalance);
                // Verify USDT balance decreased
                expect(finalBalances.usdtBalance).to.be.lt(initialBalances[`buyer${i}`].usdtBalance);
            }
        });

        it("should handle concurrent purchases correctly", async function () {
            const purchaseAmount = ethers.utils.parseUnits("500", 18); // 500 USDT

            // Prepare all buyers
            const purchasePromises = [];
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                
                // Approve USDT
                await approveUSDT(
                    buyerContracts.usdtContract,
                    saleAddress,
                    purchaseAmount,
                    buyerWallet
                );

                // Add purchase to promises array
                purchasePromises.push(
                    buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, buyerWallet)
                );
            }

            // Execute all purchases concurrently
            await Promise.all(purchasePromises);

            // Verify all purchases were successful
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const balances = await getBalances(
                    buyerContracts.tokenContract,
                    buyerContracts.usdtContract,
                    buyerWallet.address
                );
                expect(balances.tokenBalance).to.be.gt(0);
            }
        });

        it("should maintain correct token price after multiple purchases", async function () {
            const purchaseAmount = ethers.utils.parseUnits("2000", 18); // 2000 USDT

            // Get initial token price
            const initialPrice = await contracts.saleContract.getCurrentPrice();

            // Execute purchases from all buyers
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

            // Get final token price
            const finalPrice = await contracts.saleContract.getCurrentPrice();

            // Verify price has increased as expected
            expect(finalPrice).to.be.gt(initialPrice);
        });
    });
}); 