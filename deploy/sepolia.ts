import { dim } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { DeployFunction } from 'hardhat-deploy/types';
import { run } from 'hardhat';
import { deployAndLog } from '../src/deployAndLog';

// USDT and oracle addresses per network
const USDT = {
  // 11155111: '0x3454C6F3005437D97A77686F6F28cc61E2330Be0', // Sepolia
  11155111: '0x6b90A06c3042A2D883d192A2A2B814Aa47fbd311', // Sepolia
  1: '0xdac17f958d2ee523a2206206994597c13d831ec7', // Mainnet
};

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
  // Deploy Contracts
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // USDT address
  const usdtAddress = USDT[chainId];
  console.log(`Using USDT address: ${usdtAddress}`);

  // Token address (your ERC20 token - deploy this first if not already deployed)
  const tokenAddress = '0xA6C00bB82637BE2711c2536aE5f8642Fd6B472b7';
  console.log(`Using token address: ${tokenAddress}`);

  // Minimum tokens to buy
  const minTokenToBuy = ethers.utils.parseEther('1000');
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

  // Manual verification with constructor arguments properly formatted
  console.log(`\nVerifying contract on Etherscan...`);

  try {
    // Add a delay before verification to allow Etherscan to index the contract
    console.log(`Waiting for Etherscan to index the contract...`);
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second delay

    // Format constructor arguments for verification
    // Make sure to convert BigNumber objects to strings for accurate verification
    const verificationArgs = [
      oracleAddress,
      usdtAddress,
      tokenAddress,
      minTokenToBuy.toString(),
      totalTokenSupply.toString(),
    ];

    console.log('Verification arguments:', verificationArgs);

    // Verify the contract
    await run('verify:verify', {
      address: sale.address,
      constructorArguments: verificationArgs,
    });

    console.log(`Contract verified successfully!`);
  } catch (error) {
    if (error.message && error.message.includes('already verified')) {
      console.log(`Contract already verified!`);
    } else {
      console.error(`Verification error:`, error);

      // Provide instructions for manual verification
      console.log('\n=== Manual Verification Instructions ===');
      console.log('If automatic verification fails, you can verify manually on Etherscan:');
      console.log('1. Go to https://sepolia.etherscan.io/address/' + sale.address + '#code');
      console.log("2. Click on 'Verify and Publish'");
      console.log("3. Select 'Solidity (Single file)' as compiler type");
      console.log("4. Select compiler version '0.8.20'");
      console.log('5. Enter constructor arguments (ABI-encoded):');

      // Get ABI-encoded constructor arguments
      const abiEncoder = new ethers.utils.AbiCoder();
      const encodedArgs = abiEncoder
        .encode(
          ['address', 'address', 'address', 'uint256', 'uint256'],
          [
            oracleAddress,
            usdtAddress,
            tokenAddress,
            minTokenToBuy.toString(),
            totalTokenSupply.toString(),
          ],
        )
        .slice(2); // Remove '0x' prefix

      console.log(encodedArgs);
    }
  }

  console.log(`\n=== Sale Contract Deployment Summary ===`);
  console.log(`Contract address: ${sale.address}`);
  console.log(`Oracle address: ${oracleAddress}`);
  console.log(`USDT address: ${usdtAddress}`);
  console.log(`Token address: ${tokenAddress}`);
  console.log(`Minimum token purchase: ${ethers.utils.formatEther(minTokenToBuy)}`);
  console.log(`Total token supply: ${ethers.utils.formatEther(totalTokenSupply)}`);

  // Steps after deployment:
  console.log('\nAfter deployment, remember to:');
  console.log('1. Transfer tokens to the Sale contract (55% of total supply)');
  console.log('2. Call preFundContract() to activate the contract');
  console.log('3. Create a presale with createPresale()');
  console.log('4. Start the presale with startPresale()');
};

func.tags = ['Sale', 'Sepolia'];
export default func;
