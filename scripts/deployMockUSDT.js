const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MockUSDT with the account:", deployer.address);

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy(1000000); // 1,000,000 USDT
  await mockUSDT.waitForDeployment();
  console.log("MockUSDT deployed to:", await mockUSDT.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});