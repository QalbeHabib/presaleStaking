import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';

import networks from './hardhat.network';

const optimizerEnabled = true;
const config: HardhatUserConfig = {
  networks,
  etherscan: {
    apiKey: {
      // For Ethereum networks
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      // For BSC networks - using the same key 
      bscTestnet: process.env.ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'bscTestnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
    ],
  },
  
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.6',
        settings: {
          optimizer: {
            enabled: optimizerEnabled,
            runs: 2000,
          },
          evmVersion: 'berlin',
        },
      },
      {
        version: '0.8.10',
        settings: {
          optimizer: {
            enabled: optimizerEnabled,
            runs: 2000,
          },
          evmVersion: 'london',
        },
      },
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: optimizerEnabled,
            runs: 200,
          },
          evmVersion: 'london',
        },
      },
    ],
  },
};

export default config;
