const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const provider = hre.ethers.provider;
  console.log("Provider URL:", hre.network.config.url);
  const network = await provider.getNetwork();
  console.log("Connected to chain ID:", network.chainId.toString());
  const blockNumber = await provider.getBlockNumber();
  console.log("Latest block number:", blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});