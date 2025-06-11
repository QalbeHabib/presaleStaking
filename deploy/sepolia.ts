import { dim } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { DeployFunction } from 'hardhat-deploy/types';
import { run } from 'hardhat';
import { deployAndLog } from '../src/deployAndLog';

// Oracle addresses per network
const PRICE_FEED = {
  11155111: '0x694AA1769357215DE4FAC081bf1f309aDC325306', // ETH/USD on Sepolia
  1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD on Mainnet
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (process.env.DEPLOY === 'sepolia') {
    dim(`Deploying: Ethereum Sepolia`);
  } else {
    return;
  }

  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId || 11155111;

  console.log(`Deploying to chainId: ${chainId}`);

  // ===================================================
  // Deploy Test Tokens First
  // ===================================================
  console.log(`\nDeploying PresaleToken...`);

  // Total token supply - 100 billion tokens with 18 decimals
  const totalTokenSupply = ethers.parseEther('100000000000');

  const presaleToken = await deployAndLog('PresaleToken', {
    from: deployer,
    args: ['Presale Token', 'PRESALE', totalTokenSupply.toString()],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`\nDeploying TeatherUSDT...`);
  // Deploy USDT with 6 decimals and mint 10 million for testing
  const usdtInitialSupply = ethers.parseUnits('100000000000', 6); // 10 million with 6 decimals

  const teatherUsdt = await deployAndLog('TeatherUSDT', {
    from: deployer,
    args: ['Tether USD', 'USDT', usdtInitialSupply.toString()],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  // ===================================================
  // Deploy SaleUtils Library
  // ===================================================
  const saleUtils = await deployAndLog('SaleUtils', {
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  // ===================================================
  // Deploy Sale Contract
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // Token addresses - use our deployed tokens

  // Minimum tokens to buy
  const minTokenToBuy = ethers.parseEther('10');
  console.log(`Minimum token purchase: ${ethers.formatEther(minTokenToBuy)}`);

  // Prepare constructor arguments
  const constructorArgs = [
    oracleAddress,
    teatherUsdt.address,
    presaleToken.address,
    minTokenToBuy.toString(),
    totalTokenSupply.toString(),
  ];

  // Deploy the main Sale contract
  console.log(`\nDeploying Sale contract...`);
  const sale = await deployAndLog('Sale', {
    from: deployer,
    args: constructorArgs,
    skipIfAlreadyDeployed: true,
    log: true,
    libraries: {
      SaleUtils: saleUtils.address,
    },
  });

  console.log(`\nSale contract deployed at: ${sale.address}`);

  // Add delay before verification
  const verificationDelay = async () => {
    console.log(`Waiting for Etherscan to index the contracts...`);
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second delay
  };

  // ===================================================
  // Verify Contracts
  // ===================================================

  console.log(`\nVerifying contracts on Etherscan...`);
  await verificationDelay();

  // Verify PresaleToken
  try {
    console.log(`\nVerifying PresaleToken...`);
    await run('verify:verify', {
      address: presaleToken.address,
      constructorArguments: ['Presale Token', 'PRESALE', totalTokenSupply.toString()],
      contract: 'contracts/test/PresaleToken.sol:PresaleToken',
    });
    console.log(`PresaleToken verified successfully!`);
  } catch (error) {
    console.error(error);
  }

  // Verify TeatherUSDT
  try {
    await run('verify:verify', {
      address: teatherUsdt.address,
      constructorArguments: ['Tether USD', 'USDT', usdtInitialSupply.toString()],
      contract: 'contracts/test/TeatherUSDT.sol:TeatherUSDT',
    });
    console.log(`TeatherUSDT verified successfully!`);
  } catch (error) {
    console.error(error);
  }

  // Verify SaleUtils library
  try {
    console.log(`\nVerifying SaleUtils library...`);
    await run('verify:verify', {
      address: saleUtils.address,
      constructorArguments: [],
      contract: 'contracts/libraries/SaleUtils.sol:SaleUtils',
    });
    console.log(`SaleUtils verified successfully!`);
  } catch (error) {
    console.error(error);
  }

  // Verify Sale contract
  try {
    console.log(`\nVerifying Sale contract...`);
    // Use the same string arguments as deployment
    await run('verify:verify', {
      address: sale.address,
      constructorArguments: constructorArgs,
    });
    console.log(`Sale contract verified successfully!`);
  } catch (error) {
    console.error(error);
  }

  // ===================================================
  // Transfer Tokens to Sale Contract
  // ===================================================

  // console.log(`\nPreparing tokens for presale...`);

  // Calculate 55% of total supply for the Sale contract (30% presale + 5% referral + 20% staking)
  // const saleAllocation = (totalTokenSupply * 55n) / 100n;

  // // Get signer
  // const signer = await ethers.getSigner(deployer);

  // Get token contract instances
  // console.log(
  //   `\nApproving and transferring ${ethers.formatEther(saleAllocation)} tokens to Sale contract...`,
  // );
  // const saleContract = await ethers.getContractAt('Sale', sale.address);
  // const tokenContract = await ethers.getContractAt('PresaleToken', presaleToken.address);
  // const usdtContract = await ethers.getContractAt('TeatherUSDT', teatherUsdt.address);

  // // Check token balance
  // const deployerBalance = await tokenContract.balanceOf(deployer);
  // console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} PRESALE`);

  // if (deployerBalance < saleAllocation) {
  //   console.error('Insufficient balance for allocation');
  //   return;
  // }

  // try {
  //   // Transfer tokens to Sale contract
  //   // const tx = await tokenContract.transfer(sale.address, saleAllocation);
  //   // console.log(`

  console.log(`- Sale: ${sale.address}`);
  console.log(`- Token: ${presaleToken.address}`);
  console.log(`- USDT: ${teatherUsdt.address}`);
  console.log(`\nDashboard: https://sepolia.etherscan.io/address/${sale.address}#code`);
};

func.tags = ['Sale', 'Sepolia'];
export default func;
