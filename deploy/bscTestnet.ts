// const PRICE_FEED = {
//   11155111: '0x694AA1769357215DE4FAC081bf1f309aDC325306', // ETH/USD on Sepolia
//   1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD on Mainnet
//   97: '0x1A26d803C2e796601794f8C5609549643832702C', // ETH/USD on BSC Testnet
// };

// BSC Testnet deployment script (placeholder)
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // This is a placeholder for BSC Testnet deployment
  // Currently not implemented
  if (process.env.DEPLOY !== 'bscTestnet') {
    return;
  }

  console.log('BSC Testnet deployment not implemented yet');
};

func.tags = ['Sale', 'BSCTestnet'];
export default func;
