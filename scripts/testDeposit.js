// scripts/testDeposit.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const mockUSDTAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const depositContractAddress = "0xD011F5Fc1a4Fcb3527c07B7fE55FAC72841216d5";
  const amount = hre.ethers.parseUnits("100", 6); // 100 USDT

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);

  const DepositContract = await hre.ethers.getContractFactory("DepositContract");
  const depositContract = DepositContract.attach(depositContractAddress);

  console.log("Approving DepositContract to spend 100 USDT...");
  const approveTx = await mockUSDT.approve(depositContractAddress, amount);
  await approveTx.wait();
  console.log("Approval successful, tx hash:", approveTx.hash);

  console.log("Depositing 100 USDT...");
  const depositTx = await depositContract.deposit(amount);
  await depositTx.wait();
  console.log("Deposit successful, tx hash:", depositTx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});