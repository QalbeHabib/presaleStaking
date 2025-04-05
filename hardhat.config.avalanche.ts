import config from './hardhat.config';

config.etherscan = {
  apiKey: process.env.SNOWTRACE_API_KEY,
};

export default config;
