import { dim } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import { DeployFunction } from 'hardhat-deploy/types';
import { run } from 'hardhat';
import { deployAndLog } from '../src/deployAndLog';

// Oracle addresses per network
const PRICE_FEED = {
  11155111: '0x694AA1769357215DE4FAC081bf1f309aDC325306', // ETH/USD on Sepolia
  1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD on Mainnet
  97: '0x1A26d803C2e796601794f8C5609549643832702C', // ETH/USD on BSC Testnet
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (process.env.DEPLOY === 'bscTestnet') {
    dim(`Deploying: BSC Testnet`);
  } else {
    return;
  }

  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId || 97;

  console.log(`Deploying to chainId: ${chainId}`);

  // ===================================================
  // Deploy Test Tokens First
  // ===================================================
  console.log(`\nDeploying PresaleToken...`);

  // Total token supply - 100 billion tokens with 18 decimals
  const totalTokenSupply = ethers.parseEther('100000000000');

  const presaleToken = await deployAndLog('PresaleToken', {
    from: deployer,
    args: ["Presale Token", "PRESALE", totalTokenSupply],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`\nDeploying TeatherUSDT...`);
  // Deploy USDT with 6 decimals and mint 10 million for testing
  const usdtInitialSupply = ethers.parseUnits('100000000000', 6); // 10 million with 6 decimals

  const teatherUsdt = await deployAndLog('TeatherUSDT', {
    from: deployer,
    args: ["Tether USD", "USDT", usdtInitialSupply],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  // console.log(`PresaleToken deployed at: ${presaleToken.address}`);
  // console.log(`TeatherUSDT deployed at: ${teatherUsdt.address}`);

  // ===================================================
  // Deploy SaleUtils Library
  // ===================================================
  // console.log(`\nDeploying SaleUtils library...`);
  const saleUtils = await deployAndLog('SaleUtils', {
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: true,
    log: true,
  });

  console.log(`SaleUtils deployed at: ${saleUtils.address}`);

  // ===================================================
  // Deploy Sale Contract
  // ===================================================

  // Oracle address (Chainlink ETH/USD price feed)
  const oracleAddress = PRICE_FEED[chainId];
  console.log(`Using oracle address: ${oracleAddress}`);

  // Token addresses - use our deployed tokens
//   const tokenAddress = "0xeC5bd71EbC0f48024ED4aF9CC5abB66060198306"
//   const usdtAddress = "0x3454C6F3005437D97A77686F6F28cc61E2330Be0"
//   const saleUtilsAddress = "0x23A92400A88B1F849D315471c2a3F1FDB311774d"
  console.log(`Using token address: ${presaleToken.address}`);
  console.log(`Using USDT address: ${teatherUsdt.address}`);

  // Minimum tokens to buy
  const minTokenToBuy = ethers.parseEther('10');
  console.log(`Minimum token purchase: ${ethers.formatEther(minTokenToBuy)}`);

  // Prepare constructor arguments
  const constructorArgs = [
    oracleAddress,
    teatherUsdt.address,
    presaleToken.address,
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
      SaleUtils: saleUtils.address
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
      address: presaleToken.address,
      constructorArguments: ["Presale Token", "PRESALE", totalTokenSupply.toString()],
      contract: "contracts/test/PresaleToken.sol:PresaleToken"
    });
    console.log(`PresaleToken verified successfully!`);
  } catch (error) {
    handleVerificationError(error, presaleToken.address);
  }

  // Verify TeatherUSDT
  try {
    console.log(`\nVerifying TeatherUSDT...`);
    await run('verify:verify', {
      address: teatherUsdt.address,
      constructorArguments: ["Tether USD", "USDT", usdtInitialSupply.toString()],
      contract: "contracts/test/TeatherUSDT.sol:TeatherUSDT"
    });
    console.log(`TeatherUSDT verified successfully!`);
  } catch (error) {
    handleVerificationError(error, teatherUsdt.address);
  }

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
      teatherUsdt.address,
      presaleToken.address,
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
  const saleAllocation = totalTokenSupply * 55n / 100n;

  // Get token contract instances - compatible with ethers v5 and hardhat-ethers
  const presaleTokenContract = await ethers.getContractFactory("PresaleToken")
    .then(factory => factory.attach(presaleToken.address));

  console.log(`\nApproving and transferring ${ethers.formatEther(saleAllocation)} tokens to Sale contract...`);

  // Check token balance
  const deployerBalance = await presaleTokenContract.balanceOf(deployer);
  console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} PRESALE`);

  try {
    // Transfer tokens to Sale contract
    const tx = await presaleTokenContract.transfer(sale.address, saleAllocation);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`Successfully transferred tokens to Sale contract`);

    // Check Sale contract balance
    const saleBalance = await presaleTokenContract.balanceOf(sale.address);
    console.log(`Sale contract balance: ${ethers.formatEther(saleBalance)} PRESALE`);
  } catch (error) {
    console.error("Failed to transfer tokens:", error);
    console.log(`\nPlease manually transfer ${ethers.formatEther(saleAllocation)} tokens to Sale contract at ${sale.address}`);
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
    console.log(`\nYou may need to verify manually at https://testnet.bscscan.com/address/${contractAddress}#code`);
  }
}

func.tags = ['Sale', 'BSCTestnet'];
export default func;
