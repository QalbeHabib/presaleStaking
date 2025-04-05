import config from './hardhat.config';

config.etherscan = {
  apiKey: process.env.OP_ETHERSCAN_API_KEY,
};

export default config;
