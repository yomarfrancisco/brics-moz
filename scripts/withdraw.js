const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const depositContractAddress = "0x02191A9b285b72907624014ed0b4e62d89Dfb881";
  const amount = hre.ethers.parseUnits("2", 6);

  const DepositContract = await hre.ethers.getContractFactory("DepositContract");
  const depositContract = DepositContract.attach(depositContractAddress);

  console.log(`Withdrawing ${amount} Mock USDT`);
  const tx = await depositContract.connect(signer).withdraw(amount);
  await tx.wait();
  console.log("Withdrawal successful, tx hash:", tx.hash);

  // Record withdrawal in backend
  const response = await fetch('http://localhost:4000/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: "0xb04939b55498127623f4e9578A9c2BA40b2852DF",
      amount: 2,
      chainId: 11155111,
      txHash: tx.hash,
    }),
  });
  const result = await response.json();
  console.log("Backend response:", result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});