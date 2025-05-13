const { ethers } = require("hardhat");
const { expect } = require("chai");

// Private keys for different buyers
const BUYER_1_PRIVATE_KEY = process.env.BUYER_1_PRIVATE_KEY;
const BUYER_2_PRIVATE_KEY = process.env.BUYER_2_PRIVATE_KEY;
const BUYER_3_PRIVATE_KEY = process.env.BUYER_3_PRIVATE_KEY;
const BUYER_4_PRIVATE_KEY = process.env.BUYER_4_PRIVATE_KEY;
const ADMIN_PRIVATE_KEY = process.env.PRIVATE_KEY;

// Helper function to create wallets from private keys
function createWallets(provider) {
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY).connect(provider);
    const buyer1Wallet = new ethers.Wallet(BUYER_1_PRIVATE_KEY).connect(provider);
    const buyer2Wallet = new ethers.Wallet(BUYER_2_PRIVATE_KEY).connect(provider);
    const buyer3Wallet = new ethers.Wallet(BUYER_3_PRIVATE_KEY).connect(provider);
    const buyer4Wallet = new ethers.Wallet(BUYER_4_PRIVATE_KEY).connect(provider);

    return {
        adminWallet,
        buyer1Wallet,
        buyer2Wallet,
        buyer3Wallet,
        buyer4Wallet
    };
}

// Helper function to get contract instances
async function getContractInstances(saleAddress, tokenAddress, usdtAddress, wallet) {
    const Sale = await ethers.getContractFactory("Sale");
    const PresaleToken = await ethers.getContractFactory("PresaleToken");
    const TeatherUSDT = await ethers.getContractFactory("TeatherUSDT");

    const saleContract = Sale.attach(saleAddress).connect(wallet);
    const tokenContract = PresaleToken.attach(tokenAddress).connect(wallet);
    const usdtContract = TeatherUSDT.attach(usdtAddress).connect(wallet);

    return {
        saleContract,
        tokenContract,
        usdtContract
    };
}

// Helper function to approve USDT spending
async function approveUSDT(usdtContract, spender, amount, wallet) {
    const tx = await usdtContract.connect(wallet).approve(spender, amount);
    await tx.wait();
}

// Helper function to buy tokens
async function buyTokens(saleContract, usdtContract, amount, wallet) {
    const tx = await saleContract.connect(wallet).buyTokens(amount);
    await tx.wait();
    return tx;
}

// Helper function to stake tokens
async function stakeTokens(saleContract, amount, wallet) {
    const tx = await saleContract.connect(wallet).stakeTokens(amount);
    await tx.wait();
    return tx;
}

// Helper function to add referral
async function addReferral(saleContract, referrer, wallet) {
    const tx = await saleContract.connect(wallet).addReferral(referrer);
    await tx.wait();
    return tx;
}

// Helper function to check balances
async function getBalances(tokenContract, usdtContract, address) {
    const tokenBalance = await tokenContract.balanceOf(address);
    const usdtBalance = await usdtContract.balanceOf(address);
    return {
        tokenBalance,
        usdtBalance
    };
}

module.exports = {
    createWallets,
    getContractInstances,
    approveUSDT,
    buyTokens,
    stakeTokens,
    addReferral,
    getBalances
}; 