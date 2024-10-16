import dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  paths: {
    sources: "./contracts",
  },
  networks: {
    polygon: {
      url: process.env.INFURA_URL,
      chainId: parseInt(`${process.env.CHAIN_ID}`),
      accounts: {
        mnemonic: process.env.SECRET
      }
    }
  },
  etherscan: {
    apiKey: process.env.API_KEY
  },
  sourcify: {
    enabled: false
  }
};

export default config;
