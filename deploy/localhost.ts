import { dim } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { DeployFunction } from 'hardhat-deploy/types';
import { run } from 'hardhat';
import { deployAndLog } from '../src/deployAndLog';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (process.env.DEPLOY === 'localhost') {
        dim(`Deploying: Localhost Test Environment`);
    } else {
        return;
    }

    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId || 31337;

    console.log(`Deploying to chainId: ${chainId}`);

    // ===================================================
    // Deploy Mock Contracts
    // ===================================================

    // Deploy mock token for USDT
    console.log(`\nDeploying Mock USDT token...`);
    const MockUSDT = await ethers.getContractFactory("TestUSDT");
    const mockUSDT = await MockUSDT.deploy(
        "Test USDT",
        "TUSDT",
        ethers.utils.parseUnits("10000000", 6) // 10 million with 6 decimals
    );
    await mockUSDT.deployed();
    console.log(`Mock USDT deployed at: ${mockUSDT.address}`);

    // Deploy mock token for sale token
    console.log(`\nDeploying Mock Sale token...`);
    const MockToken = await ethers.getContractFactory("TestToken");
    const mockToken = await MockToken.deploy(
        "Test Token",
        "TEST",
        ethers.utils.parseEther("100000000000") // 100 billion tokens
    );
    await mockToken.deployed();
    console.log(`Mock Sale token deployed at: ${mockToken.address}`);

    // Deploy mock oracle
    console.log(`\nDeploying Mock Price Oracle...`);
    const MockOracle = await ethers.getContractFactory("MockAggregator");
    const mockOracle = await MockOracle.deploy();
    await mockOracle.deployed();
    console.log(`Mock Oracle deployed at: ${mockOracle.address}`);

    // ===================================================
    // Deploy Sale Contract
    // ===================================================

    // Minimum tokens to buy
    const minTokenToBuy = ethers.utils.parseEther('1000');
    console.log(`Minimum token purchase: ${ethers.utils.formatEther(minTokenToBuy)}`);

    // Total token supply
    const totalTokenSupply = ethers.utils.parseEther('100000000000');
    console.log(`Total token supply: ${ethers.utils.formatEther(totalTokenSupply)}`);

    // Prepare constructor arguments
    const constructorArgs = [
        mockOracle.address,
        mockUSDT.address,
        mockToken.address,
        minTokenToBuy,
        totalTokenSupply,
    ];

    console.log(`\nDeploying Sale contract...`);
    const sale = await deployAndLog('Sale', {
        from: deployer,
        args: constructorArgs,
        skipIfAlreadyDeployed: true,
        log: true,
    });

    console.log(`\nSale contract deployed at: ${sale.address}`);

    // Transfer tokens to the Sale contract (55% of total supply)
    const tokensToTransfer = totalTokenSupply.mul(55).div(100);
    console.log(`\nTransferring ${ethers.utils.formatEther(tokensToTransfer)} tokens to Sale contract...`);
    await mockToken.transfer(sale.address, tokensToTransfer);

    // Call preFundContract to activate it
    console.log(`\nCalling preFundContract() to activate the contract...`);
    const saleContract = await ethers.getContractAt("Sale", sale.address);
    await saleContract.preFundContract();

    console.log(`\n=== Local Deployment Summary ===`);
    console.log(`Sale contract: ${sale.address}`);
    console.log(`Mock USDT: ${mockUSDT.address}`);
    console.log(`Mock Sale Token: ${mockToken.address}`);
    console.log(`Mock Oracle: ${mockOracle.address}`);
    console.log(`The contract is now ready for testing!`);
};

func.tags = ['Sale', 'Localhost'];
export default func; 