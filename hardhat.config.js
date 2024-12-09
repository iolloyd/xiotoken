require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const networks = {
  hardhat: {
    chainId: 1337
  }
};

// Add Base Mainnet if configured
if (process.env.BASE_MAINNET_RPC_URL) {
  networks.base_mainnet = {
    url: process.env.BASE_MAINNET_RPC_URL,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 8453,
    gasPrice: 1000000000 // 1 gwei
  };
}

// Add Base Goerli if configured
if (process.env.BASE_GOERLI_RPC_URL) {
  networks.base_goerli = {
    url: process.env.BASE_GOERLI_RPC_URL,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 84531,
    gasPrice: 1000000000 // 1 gwei
  };
}

// Add Hyperliquid if configured
if (process.env.HYPERLIQUID_RPC_URL && process.env.HYPERLIQUID_CHAIN_ID) {
  networks.hyperliquid = {
    url: process.env.HYPERLIQUID_RPC_URL,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: Number(process.env.HYPERLIQUID_CHAIN_ID)
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks,
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY,
      base_goerli: process.env.BASESCAN_API_KEY
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "base_goerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 60000
  }
};