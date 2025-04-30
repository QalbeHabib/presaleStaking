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
  // Deploy SaleUtils Library First
  // ===================================================
  console.log(`\nDeploying SaleUtils library...`);
  const saleUtils = await deployAndLog('SaleUtils', {
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`SaleUtils deployed at: ${saleUtils.address}`);

  // ===================================================
  // Deploy Sale Contract and dependencies
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // Token addresses
  const tokenAddress = "0x3d3067687CCf1d0a02f546eEB613F270E0Df59a3";
  const usdtAddress = "0x1679B569c112C40fE04BA89C99D59326De278620";

  console.log(`Using token address: ${tokenAddress}`);
  console.log(`Using USDT address: ${usdtAddress}`);

  // Minimum tokens to buy
  const minTokenToBuy = ethers.utils.parseEther('10');
  console.log(`Minimum token purchase: ${ethers.utils.formatEther(minTokenToBuy)}`);

  // Total token supply
  const totalTokenSupply = ethers.utils.parseEther('100000000000');
  console.log(`Total token supply: ${ethers.utils.formatEther(totalTokenSupply)}`);

  // Prepare constructor arguments
  const constructorArgs = [
    oracleAddress,
    usdtAddress,
    tokenAddress,
    minTokenToBuy,
    totalTokenSupply,
  ];

  // Deploy the main Sale contract 
  console.log(`\nDeploying Sale contract...`);
  const sale = await deployAndLog('Sale', {
    from: deployer,
    args: constructorArgs,
    skipIfAlreadyDeployed: true,
    log: true,
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

  // Verify SaleUtils library
  try {
    console.log(`\nVerifying SaleUtils library...`);
    await run('verify:verify', {
      address: saleUtils.address,
      constructorArguments: [],
      contract: "contracts/libraries/SaleUtils.sol:SaleUtils"
    });
    console.log(`SaleUtils verified successfully!`);
  } catch (error) {
    handleVerificationError(error, saleUtils.address);
  }

  // Verify Sale contract
  try {
    console.log(`\nVerifying Sale contract...`);
    // Format constructor arguments for verification
    const verificationArgs = [
      oracleAddress,
      usdtAddress,
      tokenAddress,
      minTokenToBuy.toString(),
      totalTokenSupply.toString(),
    ];

    await run('verify:verify', {
      address: sale.address,
      constructorArguments: verificationArgs
    });
    console.log(`Sale contract verified successfully!`);
  } catch (error) {
    handleVerificationError(error, sale.address);
  }

  // ===================================================
  // Transfer Tokens to Sale Contract
  // ===================================================

  console.log(`\nManual steps for token transfer and pre-funding:`);

  // Calculate 55% of total supply for the Sale contract
  const saleAllocation = totalTokenSupply.mul(55).div(100);
  console.log(`1. Transfer ${ethers.utils.formatEther(saleAllocation)} tokens to Sale contract at ${sale.address}`);
  console.log(`2. Call preFundContract() on the Sale contract to enable presale, referral, and staking`);

  console.log(`\n=== Deployment Summary ===`);
  console.log(`SaleUtils library: ${saleUtils.address}`);
  console.log(`Sale contract address: ${sale.address}`);
  console.log(`Oracle address: ${oracleAddress}`);

  console.log('\nNext steps:');
  console.log('1. Create a presale with createPresale()');
  console.log('2. Start the presale with startPresale()');
};

// Helper function to handle verification errors
function handleVerificationError(error, contractAddress) {
  if (error.message && error.message.includes('already verified')) {
    console.log(`Contract already verified!`);
  } else {
    console.error(`Verification error:`, error);
    console.log(`\nYou may need to verify manually at https://sepolia.etherscan.io/address/${contractAddress}#code`);
  }
}

func.tags = ['Sale', 'Sepolia'];
export default func;
