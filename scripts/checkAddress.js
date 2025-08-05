const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});