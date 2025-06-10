import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import "dotenv/config";

if (!process.env.LOCAL_RPC_URL) {
  throw new Error("Please set LOCAL_RPC_URL in your environment variables");
}

if (!process.env.PRIVATE_KEY) {
  throw new Error("Please set PRIVATE_KEY in your environment variables");
}

const config: HardhatUserConfig = {
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      url: process.env.LOCAL_RPC_URL ,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};

export default config;
