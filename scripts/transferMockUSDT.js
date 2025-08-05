// scripts/transferMockUSDT.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const mockUSDTAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53"; // From deployMockUSDT.js
  const recipient = "0xb04939B55498127623f4e9578A9c2BA40b2852DF"; // Your test account
  const amount = hre.ethers.parseUnits("1000", 6); // 1000 USDT (6 decimals)

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);

  console.log("Transferring 1000 USDT to", recipient);
  const tx = await mockUSDT.transfer(recipient, amount);
  await tx.wait();
  console.log("Transfer successful, tx hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});