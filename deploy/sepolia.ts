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
  // Deploy Test Tokens
  // ===================================================

  // Deploy TestToken
  console.log(`\nDeploying TestToken contract...`);
  const tokenName = "Test Token";
  const tokenSymbol = "TEST";
  const decimals = 18;
  const initialSupply = ethers.utils.parseEther('100000000000'); // 100 billion tokens

  const testToken = await deployAndLog('TestToken', {
    from: deployer,
    args: [tokenName, tokenSymbol, initialSupply],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`TestToken deployed at: ${testToken.address}`);

  // Deploy TestUSDT
  console.log(`\nDeploying TestUSDT contract...`);
  const usdtName = "Test USDT";
  const usdtSymbol = "TUSDT";
  const usdtDecimals = 6; // USDT typically has 6 decimals
  const usdtInitialSupply = ethers.utils.parseUnits('100000000000', 6); // 100 billion USDT

  const testUSDT = await deployAndLog('TestUSDT', {
    from: deployer,
    args: [usdtName, usdtSymbol, usdtInitialSupply],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`TestUSDT deployed at: ${testUSDT.address}`);

  // ===================================================
  // Deploy Sale Contract
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // Use the deployed test tokens
  const tokenAddress = testToken.address;
  const usdtAddress = testUSDT.address;

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

  // Verify TestToken
  try {
    console.log(`\nVerifying TestToken...`);
    await run('verify:verify', {
      address: testToken.address,
      constructorArguments: [tokenName, tokenSymbol, initialSupply.toString()],
    });
    console.log(`TestToken verified successfully!`);
  } catch (error) {
    handleVerificationError(error, testToken.address);
  }

  // Verify TestUSDT
  try {
    console.log(`\nVerifying TestUSDT...`);
    await run('verify:verify', {
      address: testUSDT.address,
      constructorArguments: [usdtName, usdtSymbol, usdtInitialSupply.toString()],
    });
    console.log(`TestUSDT verified successfully!`);
  } catch (error) {
    handleVerificationError(error, testUSDT.address);
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
      constructorArguments: verificationArgs,
    });
    console.log(`Sale contract verified successfully!`);
  } catch (error) {
    handleVerificationError(error, sale.address);
  }

  // ===================================================
  // Transfer Tokens to Sale Contract
  // ===================================================

  console.log(`\nTransferring tokens to Sale contract...`);

  // Calculate 55% of total supply for the Sale contract (30% presale + 5% referral + 20% staking)
  const saleAllocation = initialSupply.mul(55).div(100);

  try {
    const tokenContract = await ethers.getContractAt("TestToken", tokenAddress);
    await tokenContract.transfer(sale.address, saleAllocation);
    console.log(`Transferred ${ethers.utils.formatEther(saleAllocation)} tokens to Sale contract`);

    // Check balance of Sale contract
    const balance = await tokenContract.balanceOf(sale.address);
    console.log(`Sale contract balance: ${ethers.utils.formatEther(balance)} tokens`);

    // Pre-fund the contract
    const saleContract = await ethers.getContractAt("Sale", sale.address);
    await saleContract.preFundContract();
    console.log(`Sale contract pre-funded successfully!`);
  } catch (error) {
    console.error(`Error transferring tokens to Sale contract:`, error);
    console.log(`\nManual steps needed:`);
    console.log(`1. Transfer ${ethers.utils.formatEther(saleAllocation)} tokens to Sale contract at ${sale.address}`);
    console.log(`2. Call preFundContract() on the Sale contract`);
  }

  console.log(`\n=== Deployment Summary ===`);
  console.log(`TestToken address: ${testToken.address}`);
  console.log(`TestUSDT address: ${testUSDT.address}`);
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
