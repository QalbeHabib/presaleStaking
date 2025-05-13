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

describe("Combined Functionality Integration Tests", function () {
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

    describe("Combined Features Integration", function () {
        it("should handle purchase, staking, and referral rewards together", async function () {
            const purchaseAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT
            const stakeAmount = ethers.utils.parseUnits("500", 18); // 500 tokens

            // Set up referral chain
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

            // All buyers stake their tokens
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                await stakeTokens(buyerContracts.saleContract, stakeAmount, buyerWallet);
            }

            // Fast forward time (simulate time passing)
            await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
            await ethers.provider.send("evm_mine");

            // Check staking rewards
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const rewards = await buyerContracts.saleContract.calculateRewards(buyerWallet.address);
                expect(rewards).to.be.gt(0);
            }

            // Unstake tokens
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                await buyerContracts.saleContract.unstakeTokens();
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

                // All balances should be higher than initial due to purchase, referral rewards, and staking rewards
                expect(finalBalances.tokenBalance).to.be.gt(initialBalances[`buyer${i}`].tokenBalance);
            }
        });

        it("should handle multiple rounds of purchases and staking", async function () {
            const purchaseAmount = ethers.utils.parseUnits("500", 18); // 500 USDT
            const stakeAmount = ethers.utils.parseUnits("250", 18); // 250 tokens

            // Set up referral chain
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            await addReferral(contracts.saleContract, wallets.buyer4Wallet.address, wallets.buyer3Wallet);

            // Perform multiple rounds of purchases and staking
            for (let round = 0; round < 3; round++) {
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

                // All buyers stake their tokens
                for (let i = 1; i <= 4; i++) {
                    const buyerWallet = wallets[`buyer${i}Wallet`];
                    const buyerContracts = await getContractInstances(
                        saleAddress,
                        tokenAddress,
                        usdtAddress,
                        buyerWallet
                    );
                    await stakeTokens(buyerContracts.saleContract, stakeAmount, buyerWallet);
                }

                // Fast forward time
                await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
                await ethers.provider.send("evm_mine");

                // Unstake tokens
                for (let i = 1; i <= 4; i++) {
                    const buyerWallet = wallets[`buyer${i}Wallet`];
                    const buyerContracts = await getContractInstances(
                        saleAddress,
                        tokenAddress,
                        usdtAddress,
                        buyerWallet
                    );
                    await buyerContracts.saleContract.unstakeTokens();
                }
            }

            // Verify all users have accumulated rewards
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const stakingInfo = await buyerContracts.saleContract.getStakingInfo(buyerWallet.address);
                expect(stakingInfo.totalRewards).to.be.gt(0);
            }
        });

        it("should handle concurrent operations correctly", async function () {
            const purchaseAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT
            const stakeAmount = ethers.utils.parseUnits("500", 18); // 500 tokens

            // Set up referral chain
            await addReferral(contracts.saleContract, wallets.buyer2Wallet.address, wallets.buyer1Wallet);
            await addReferral(contracts.saleContract, wallets.buyer3Wallet.address, wallets.buyer2Wallet);
            await addReferral(contracts.saleContract, wallets.buyer4Wallet.address, wallets.buyer3Wallet);

            // Prepare all operations
            const operations = [];
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );

                // Add purchase operation
                operations.push(
                    approveUSDT(
                        buyerContracts.usdtContract,
                        saleAddress,
                        purchaseAmount,
                        buyerWallet
                    ).then(() => 
                        buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, buyerWallet)
                    )
                );

                // Add staking operation
                operations.push(
                    stakeTokens(buyerContracts.saleContract, stakeAmount, buyerWallet)
                );
            }

            // Execute all operations concurrently
            await Promise.all(operations);

            // Verify all operations were successful
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const stakingInfo = await buyerContracts.saleContract.getStakingInfo(buyerWallet.address);
                expect(stakingInfo.isStaking).to.be.true;
                expect(stakingInfo.stakedAmount).to.equal(stakeAmount);
            }
        });
    });
}); 