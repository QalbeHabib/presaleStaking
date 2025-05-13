const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    stakeTokens,
    getBalances
} = require("./helpers/integrationHelper");

describe("Staking Integration Tests", function () {
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

    describe("Multiple Users Staking", function () {
        it("should allow multiple users to stake tokens", async function () {
            const purchaseAmount = ethers.utils.parseUnits("1000", 18); // 1000 USDT
            const stakeAmount = ethers.utils.parseUnits("500", 18); // 500 tokens

            // First, let all users purchase tokens
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                
                // Approve and buy tokens
                await approveUSDT(
                    buyerContracts.usdtContract,
                    saleAddress,
                    purchaseAmount,
                    buyerWallet
                );
                await buyTokens(buyerContracts.saleContract, buyerContracts.usdtContract, purchaseAmount, buyerWallet);
            }

            // Get initial staking info
            const initialStakingInfo = {};
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                initialStakingInfo[`buyer${i}`] = await buyerContracts.saleContract.getStakingInfo(buyerWallet.address);
            }

            // Stake tokens for all users
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

            // Verify staking info for all users
            for (let i = 1; i <= 4; i++) {
                const buyerWallet = wallets[`buyer${i}Wallet`];
                const buyerContracts = await getContractInstances(
                    saleAddress,
                    tokenAddress,
                    usdtAddress,
                    buyerWallet
                );
                const finalStakingInfo = await buyerContracts.saleContract.getStakingInfo(buyerWallet.address);
                
                expect(finalStakingInfo.stakedAmount).to.equal(stakeAmount);
                expect(finalStakingInfo.stakingStartTime).to.be.gt(0);
                expect(finalStakingInfo.isStaking).to.be.true;
            }
        });

        it("should calculate rewards correctly for multiple stakers", async function () {
            const stakeAmount = ethers.utils.parseUnits("1000", 18); // 1000 tokens

            // Stake tokens for all users
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

            // Check rewards for all users
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
        });

        it("should handle unstaking correctly for multiple users", async function () {
            const stakeAmount = ethers.utils.parseUnits("1000", 18); // 1000 tokens

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

            // Stake tokens for all users
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

            // Unstake tokens for all users
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

                // Verify token balance increased (including rewards)
                expect(finalBalances.tokenBalance).to.be.gt(initialBalances[`buyer${i}`].tokenBalance);
            }
        });
    });
}); 