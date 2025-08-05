// scripts/checkWalletBalance.js
const hre = require("hardhat");

async function main() {
  const usdtAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const wallet = "0xb04939B55498127623F4E9578A9c2BA40b2852DF"; // Correct checksum
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const usdt = MockUSDT.attach(usdtAddress);
  const balance = await usdt.balanceOf(wallet);
  console.log(`Wallet ${wallet} balance: ${hre.ethers.formatUnits(balance, 6)} Mock USDT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});