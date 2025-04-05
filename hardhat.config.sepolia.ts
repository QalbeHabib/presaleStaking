import config from './hardhat.config';

config.etherscan = {
  apiKey: process.env.ETHERSCAN_API_KEY,
};

export default config;
