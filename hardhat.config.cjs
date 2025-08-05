require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.VITE_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/FlBOuTS3mAuXwKlI5pIitlyVpSYwgtC8",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 60000,
      httpHeaders: {
        "User-Agent": "Hardhat/2.22.10"
      },
      retry: {
        retries: 3,
        delay: 1000
      }
    },
    mainnet: {
      url: "https://eth.llamarpc.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453
    },
    optimism: {
      url: "https://mainnet.optimism.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 10
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 42161
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "your_etherscan_api_key",
      mainnet: process.env.ETHERSCAN_API_KEY || "your_etherscan_api_key"
    }
  }
};
