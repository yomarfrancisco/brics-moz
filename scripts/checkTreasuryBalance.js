
const hre = require("hardhat");

async function main() {
  const usdtAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const treasury = "0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f";
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const usdt = MockUSDT.attach(usdtAddress);
  const balance = await usdt.balanceOf(treasury);
  console.log(`Treasury balance: ${hre.ethers.formatUnits(balance, 6)} Mock USDT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});