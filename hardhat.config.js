require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-gas-reporter");
require("hardhat-docgen");
require("solidity-coverage");
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      metadata: {
        bytecodeHash: "none"
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      gas: "auto",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk"
      }
    },
    base: {
      url: BASE_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 8453,
      verify: {
        etherscan: {
          apiKey: BASESCAN_API_KEY
        }
      }
    },
    baseGoerli: {
      url: "https://goerli.base.org",
      accounts: [PRIVATE_KEY],
      chainId: 84531,
      verify: {
        etherscan: {
          apiKey: BASESCAN_API_KEY
        }
      }
    }
  },
  etherscan: {
    apiKey: {
      base: BASESCAN_API_KEY,
      baseGoerli: BASESCAN_API_KEY
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
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    excludeContracts: ["test/"],
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};