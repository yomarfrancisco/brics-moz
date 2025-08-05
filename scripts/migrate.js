const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Migrating funds with account:", signer.address);

  const usdtAddress = "0x638F9132EA2737Fa15b200627516FCe77bE6CE53";
  const treasuryAddress = "0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f";
  const newDepositContractAddress = "<NEW_CONTRACT_ADDRESS>"; // Replace with deployed address
  const amount = hre.ethers.parseUnits("998108.5", 6);

  const usdtContract = new hre.ethers.Contract(usdtAddress, [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
  ], signer);

  // Check treasury balance
  const treasuryBalance = await usdtContract.balanceOf(treasuryAddress);
  console.log(`Treasury balance: ${hre.ethers.formatUnits(treasuryBalance, 6)} USDT`);

  // Transfer USDT to new contract
  const tx = await usdtContract.transfer(newDepositContractAddress, amount);
  await tx.wait();
  console.log("Migration successful, tx hash:", tx.hash);

  // Verify new contract balance
  const newContractBalance = await usdtContract.balanceOf(newDepositContractAddress);
  console.log(`New DepositContract balance: ${hre.ethers.formatUnits(newContractBalance, 6)} USDT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});