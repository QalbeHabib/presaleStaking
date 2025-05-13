import { HardhatUserConfig } from 'hardhat/config';
const alchemyUrl = process.env.ALCHEMY_URL;
const infuraApiKey = process.env.INFURA_API_KEY;
const privateKey = process.env.PRIVATE_KEY;
const avalanche = process.env.AVALANCHE_ENABLED;
const arbitrumGoerliRPCUrl = process.env.ARBITRUM_GOERLI_RPC_URL;
const optimismGoerliRPCUrl = process.env.OPTIMISM_GOERLI_RPC_URL;
const mumbaiRPCUrl = process.env.MUMBAI_RPC_URL;
const sepoliaRPCUrl = process.env.SEPOLIA_RPC_URL;


// Prepare accounts configuration - either with private key or empty
const accountsConfig = privateKey ? [privateKey] : undefined;

const networks: HardhatUserConfig['networks'] = {
  localhost: {
    chainId: 31337,
    url: 'http://127.0.0.1:8545',
    allowUnlimitedContractSize: true,
  },
};

if (alchemyUrl && process.env.FORK_ENABLED) {
  networks.hardhat = {
    chainId: 1,
    allowUnlimitedContractSize: true,
    gas: 12000000,
    blockGasLimit: 0x1fffffffffffff,
    forking: {
      url: alchemyUrl,
    },
  };
} else {
  networks.hardhat = {
    allowUnlimitedContractSize: true,
    gas: 12000000,
    blockGasLimit: 0x1fffffffffffff,
  };
}

if (!!avalanche && privateKey) {
  networks.fuji = {
    chainId: 43113,
    url: 'https://api.avax-test.network/ext/bc/C/rpc',
    accounts: accountsConfig,
  };
}

if (infuraApiKey && privateKey) {
  networks.arbitrumGoerli = {
    chainId: 421613,
    url: arbitrumGoerliRPCUrl
      ? arbitrumGoerliRPCUrl
      : `https://arbitrum-goerli.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
  };

  networks.optimismGoerli = {
    chainId: 420,
    url: optimismGoerliRPCUrl
      ? optimismGoerliRPCUrl
      : `https://optimism-goerli.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
  };

  networks.mumbai = {
    chainId: 80001,
    url: mumbaiRPCUrl ? mumbaiRPCUrl : `https://polygon-mumbai.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
  };

  networks.goerli = {
    chainId: 5,
    url: `https://goerli.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
  };

  networks.sepolia = {
    chainId: 11155111,
    url: sepoliaRPCUrl ? sepoliaRPCUrl : `https://sepolia.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
    timeout: 60000,
  };

  networks.bscTestnet = {
    chainId: 97,
    url: `https://bsc-testnet.infura.io/v3/${infuraApiKey}`,
    accounts: accountsConfig,
    timeout: 60000,
  };

  networks.mainnet = {
    url: alchemyUrl,
    accounts: accountsConfig,
  };
} else {
  console.warn('No infura or private key available for testnets');
}

export default networks;
