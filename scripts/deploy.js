const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const chainConfig = {
    11155111: {
      usdt: "0x638F9132EA2737Fa15b200627516FCe77bE6CE53", // Sepolia MockUSDT
    },
    1: {
      usdt: "0xdac17f958d2ee523a2206206994597c13d831ec7", // Ethereum USDT
    },
    8453: {
      usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Base USDT
    },
    10: {
      usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism USDT
    },
    42161: {
      usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum USDT
    },
  };

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Deploying on chain ID: ${chainId}`);

  const config = chainConfig[chainId];
  if (!config) {
    throw new Error(`No configuration for chain ID ${chainId}`);
  }

  console.log("Provider URL:", hre.network.config.url);
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("Latest block number:", blockNumber);

  const DepositContract = await hre.ethers.getContractFactory("DepositContract");
  const deployTx = await DepositContract.getDeployTransaction(config.usdt);
  const gasEstimate = await hre.ethers.provider.estimateGas(deployTx);
  console.log("Estimated gas for deployment:", gasEstimate.toString());

  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Fee data:", {
    gasPrice: feeData.gasPrice ? hre.ethers.formatUnits(feeData.gasPrice, "gwei") : null,
    maxFeePerGas: feeData.maxFeePerGas ? hre.ethers.formatUnits(feeData.maxFeePerGas, "gwei") : null,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? hre.ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : null,
  });

  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log("Deployer nonce:", nonce);

  // Use BigInt arithmetic for gas limit (add 20% buffer)
  const gasLimit = (gasEstimate * 12n) / 10n;

  const deployOptions = {
    nonce,
    gasLimit: gasLimit.toString(),
    maxFeePerGas: feeData.maxFeePerGas || undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
  };
  console.log("Deploy options:", deployOptions);

  const depositContract = await DepositContract.deploy(config.usdt, deployOptions);
  await depositContract.waitForDeployment();
  const contractAddress = await depositContract.getAddress();
  console.log("DepositContract deployed to:", contractAddress);

  // Verify contract on Etherscan (Sepolia)
  if (chainId === 11155111) {
    console.log("Waiting for 6 confirmations before verification...");
    const txHash = depositContract.deploymentTransaction().hash;
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 30; // ~5 minutes
    while (attempts < maxAttempts) {
      receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
      if (receipt && receipt.confirmations >= 6) {
        console.log(`Transaction confirmed with ${receipt.confirmations} confirmations`);
        break;
      }
      console.log(`Waiting for confirmation (${attempts + 1}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
    }
    if (!receipt || receipt.confirmations < 6) {
      console.warn("Verification may fail: Transaction not confirmed with 6 confirmations");
    }
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [config.usdt],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Verification failed:", error.message);
      console.log("You can manually verify using: npx hardhat verify --network sepolia", contractAddress, config.usdt);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
