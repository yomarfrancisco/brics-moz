// scripts/approveTreasury.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const mockUSDTAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const depositContractAddress = "0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D";
  const amount = hre.ethers.parseUnits("1000000", 6); // Approve 1M USDT

  if (signer.address.toLowerCase() !== "0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f".toLowerCase()) {
    throw new Error("Signer must be treasury: 0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f");
  }

  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);

  console.log(`Approving ${depositContractAddress} to spend ${amount} Mock USDT from treasury`);
  const tx = await mockUSDT.connect(signer).approve(depositContractAddress, amount);
  await tx.wait();
  console.log("Approval successful, tx hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});