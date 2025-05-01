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
  const totalTokenSupply = ethers.utils.parseEther('100000000000');

  // const presaleToken = await deployAndLog('PresaleToken', {
  //   from: deployer,
  //   args: ["Presale Token", "PRESALE", totalTokenSupply],
  //   skipIfAlreadyDeployed: true,
  //   log: true,
  // });

  console.log(`\nDeploying TeatherUSDT...`);
  // Deploy USDT with 6 decimals and mint 10 million for testing
  const usdtInitialSupply = ethers.utils.parseUnits('100000000000', 6); // 10 million with 6 decimals

  // const teatherUsdt = await deployAndLog('TeatherUSDT', {
  //   from: deployer,
  //   args: ["Tether USD", "USDT", usdtInitialSupply],
  //   skipIfAlreadyDeployed: true,
  //   log: true,
  // });

  // console.log(`PresaleToken deployed at: ${presaleToken.address}`);
  // console.log(`TeatherUSDT deployed at: ${teatherUsdt.address}`);

  // ===================================================
  // Deploy SaleUtils Library
  // ===================================================
  // console.log(`\nDeploying SaleUtils library...`);
  // const saleUtils = await deployAndLog('SaleUtils', {
  //   from: deployer,
  //   args: [],
  //   skipIfAlreadyDeployed: true,
  //   log: true,
  // });

  // console.log(`SaleUtils deployed at: ${saleUtils.address}`);

  // ===================================================
  // Deploy Sale Contract
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // Token addresses - use our deployed tokens
  const tokenAddress = "0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306"
  const usdtAddress = "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f"
  const saleUtilsAddress = "0x23A92400A88B1F849D315471c2a3F1FDB311774d"
  console.log(`Using token address: ${tokenAddress}`);
  console.log(`Using USDT address: ${usdtAddress}`);

  // Minimum tokens to buy
  const minTokenToBuy = ethers.utils.parseEther('10');
  console.log(`Minimum token purchase: ${ethers.utils.formatEther(minTokenToBuy)}`);

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
    libraries: {
      SaleUtils: saleUtilsAddress
    }
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
      address: "0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306",
      constructorArguments: ["Presale Token", "PRESALE", totalTokenSupply.toString()],
      contract: "contracts/test/PresaleToken.sol:PresaleToken"
    });
    console.log(`PresaleToken verified successfully!`);
  } catch (error) {
    handleVerificationError(error, "0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306");
  }

  // Verify TeatherUSDT
  try {
    console.log(`\nVerifying TeatherUSDT...`);
    await run('verify:verify', {
      address: "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f",
      constructorArguments: ["Tether USD", "USDT", usdtInitialSupply.toString()],
      contract: "contracts/test/TeatherUSDT.sol:TeatherUSDT"
    });
    console.log(`TeatherUSDT verified successfully!`);
  } catch (error) {
    handleVerificationError(error, "0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f");
  }

  // Verify SaleUtils library
  try {
    console.log(`\nVerifying SaleUtils library...`);
    await run('verify:verify', {
      address: "0x23A92400A88B1F849D315471c2a3F1FDB311774d",
      constructorArguments: [],
      contract: "contracts/libraries/SaleUtils.sol:SaleUtils"
    });
    console.log(`SaleUtils verified successfully!`);
  } catch (error) {
    handleVerificationError(error, "0x23A92400A88B1F849D315471c2a3F1FDB311774d");
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

  console.log(`\nPreparing tokens for presale...`);

  // Calculate 55% of total supply for the Sale contract (30% presale + 5% referral + 20% staking)
  const saleAllocation = totalTokenSupply.mul(55).div(100);

  // Get signer
  const signer = await ethers.getSigner(deployer);

  // Get token contract instances
  const presaleTokenContract = await ethers.getContractAt("PresaleToken", "0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306", signer);

  console.log(`\nApproving and transferring ${ethers.utils.formatEther(saleAllocation)} tokens to Sale contract...`);

  // Check token balance
  const deployerBalance = await presaleTokenContract.balanceOf(deployer);
  console.log(`Deployer balance: ${ethers.utils.formatEther(deployerBalance)} PRESALE`);

  try {
    // Transfer tokens to Sale contract
    const tx = await presaleTokenContract.transfer(sale.address, saleAllocation);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`Successfully transferred tokens to Sale contract`);

    // Check Sale contract balance
    const saleBalance = await presaleTokenContract.balanceOf(sale.address);
    console.log(`Sale contract balance: ${ethers.utils.formatEther(saleBalance)} PRESALE`);
  } catch (error) {
    console.error("Failed to transfer tokens:", error);
    console.log(`\nPlease manually transfer ${ethers.utils.formatEther(saleAllocation)} tokens to Sale contract at ${sale.address}`);
  }

  console.log(`\n=== Deployment Summary ===`);
  console.log(`PresaleToken address: 0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306`);
  console.log(`TeatherUSDT address: 0x4D1D5fD48F7d6BAE9fd45955Edc292575B0D0D1f`);
  console.log(`SaleUtils library: 0x23A92400A88B1F849D315471c2a3F1FDB311774d`);
  console.log(`Sale contract address: ${sale.address}`);
  console.log(`Oracle address: ${oracleAddress}`);

  console.log('\nNext steps:');
  console.log('1. Call preFundContract() on the Sale contract to enable presale, referral, and staking');
  console.log('2. Create a presale with createPresale()');
  console.log('3. Start the presale with startPresale()');
  console.log('\nSample presale parameters:');
  console.log('- Price: 0.01 USDT per token');
  console.log('- Next stage price: 0.02 USDT per token');
  console.log('- Tokens to sell: 30% of total supply');
  console.log('- USDT hardcap: 30,000,000 USDT');
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
