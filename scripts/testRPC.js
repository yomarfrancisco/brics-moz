const hre = require("hardhat");

async function main() {
  console.log("Testing Sepolia RPC...");
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();
  console.log("Connected to chain ID:", Number(network.chainId));
  const blockNumber = await provider.getBlockNumber();
  console.log("Latest block number:", blockNumber);
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer address:", signer.address);
  const balance = await provider.getBalance(signer.address);
  console.log("Signer balance:", hre.ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});