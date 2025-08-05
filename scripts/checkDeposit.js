// scripts/checkDeposit.js
const hre = require("hardhat");

async function main() {
  const mockUSDTAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const depositContractAddress = "0xD011F5Fc1a4Fcb3527c07B7fE55FAC72841216d5";
  const treasuryAddress = "0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f";

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);

  const balance = await mockUSDT.balanceOf(treasuryAddress);
  console.log("Treasury USDT balance:", hre.ethers.formatUnits(balance, 6), "USDT");

  const DepositContract = await hre.ethers.getContractFactory("DepositContract");
  const depositContract = DepositContract.attach(depositContractAddress);

  const filter = depositContract.filters.Deposit();
  const events = await depositContract.queryFilter(filter);
  console.log("Deposit events:", events);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});