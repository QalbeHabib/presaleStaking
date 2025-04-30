import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';

import networks from './hardhat.network';

const optimizerEnabled = true;
const config: HardhatUserConfig = {
  networks,
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
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
            runs: 10000, // Increased optimizer runs
          },
          evmVersion: 'london',
        },
      },
    ],
  },
};

export default config;
