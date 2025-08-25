import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// USDT Contract ABI (minimal for transfer function)
const USDT_ABI = [
  "function transfer(address to, uint256 value) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
  "function symbol() public view returns (string)",
  "function name() public view returns (string)"
];

// Chain configuration
const CHAIN_CONFIG = {
  1: { // Ethereum
    name: 'Ethereum',
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    privateKey: process.env.TREASURY_PRIVATE_KEY, // Use TREASURY_PRIVATE_KEY for both chains
    usdtAddress: process.env.USDT_ETHEREUM_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    blockExplorer: 'https://etherscan.io'
  },
  8453: { // Base
    name: 'Base',
    rpcUrl: process.env.ALCHEMY_BASE_URL || 'https://mainnet.base.org',
    privateKey: process.env.TREASURY_PRIVATE_KEY, // Use TREASURY_PRIVATE_KEY for both chains
    usdtAddress: process.env.USDT_BASE_ADDRESS || '0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0',
    decimals: 6,
    blockExplorer: 'https://basescan.org'
  }
};

// Provider and signer cache
const providers = {};
const signers = {};
const contracts = {};

/**
 * Get provider for a specific chain
 * @param {number} chainId - Chain ID (1 for Ethereum, 8453 for Base)
 * @returns {ethers.Provider} Ethers provider
 */
function getProvider(chainId) {
  if (!providers[chainId]) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    if (!config.rpcUrl) {
      throw new Error(`RPC URL not configured for chain ${chainId}`);
    }
    
    providers[chainId] = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  
  return providers[chainId];
}

/**
 * Get signer for a specific chain
 * @param {number} chainId - Chain ID (1 for Ethereum, 8453 for Base)
 * @returns {ethers.Wallet} Ethers wallet signer
 */
function getSigner(chainId) {
  if (!signers[chainId]) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    if (!config.privateKey) {
      throw new Error(`Private key not configured for chain ${chainId}`);
    }
    
    const provider = getProvider(chainId);
    signers[chainId] = new ethers.Wallet(config.privateKey, provider);
  }
  
  return signers[chainId];
}

/**
 * Get USDT contract for a specific chain
 * @param {number} chainId - Chain ID (1 for Ethereum, 8453 for Base)
 * @returns {ethers.Contract} USDT contract instance
 */
function getUSDTContract(chainId) {
  if (!contracts[chainId]) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    const signer = getSigner(chainId);
    contracts[chainId] = new ethers.Contract(config.usdtAddress, USDT_ABI, signer);
  }
  
  return contracts[chainId];
}

/**
 * Validate and sanitize user address
 * @param {string} address - User address to validate
 * @returns {string} Normalized address
 */
function validateAddress(address) {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid address: must be a non-empty string');
  }
  
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  
  return ethers.getAddress(address); // Normalize address
}

/**
 * Convert USDT amount to contract units (with decimals)
 * @param {number} amount - USDT amount
 * @param {number} chainId - Chain ID
 * @returns {ethers.BigNumber} Amount in contract units
 */
function amountToContractUnits(amount, chainId) {
  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  
  // Convert to contract units (USDT has 6 decimals)
  return ethers.parseUnits(amount.toString(), config.decimals);
}

/**
 * Convert contract units back to USDT amount
 * @param {ethers.BigNumber} contractUnits - Amount in contract units
 * @param {number} chainId - Chain ID
 * @returns {number} USDT amount
 */
function contractUnitsToAmount(contractUnits, chainId) {
  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  return parseFloat(ethers.formatUnits(contractUnits, config.decimals));
}

/**
 * Check treasury USDT balance
 * @param {number} chainId - Chain ID
 * @returns {Promise<number>} Treasury balance in USDT
 */
async function getTreasuryBalance(chainId) {
  try {
    const contract = getUSDTContract(chainId);
    const signer = getSigner(chainId);
    const treasuryAddress = await signer.getAddress();
    
    const balance = await contract.balanceOf(treasuryAddress);
    return contractUnitsToAmount(balance, chainId);
  } catch (error) {
    console.error(`Error getting treasury balance for chain ${chainId}:`, error);
    throw new Error(`Failed to get treasury balance: ${error.message}`);
  }
}

/**
 * Estimate gas for USDT transfer
 * @param {string} toAddress - Recipient address
 * @param {number} amount - USDT amount
 * @param {number} chainId - Chain ID
 * @returns {Promise<ethers.BigNumber>} Estimated gas
 */
async function estimateTransferGas(toAddress, amount, chainId) {
  try {
    const contract = getUSDTContract(chainId);
    const contractAmount = amountToContractUnits(amount, chainId);
    const normalizedAddress = validateAddress(toAddress);
    
    const gasEstimate = await contract.transfer.estimateGas(normalizedAddress, contractAmount);
    return gasEstimate;
  } catch (error) {
    console.error(`Error estimating gas for transfer on chain ${chainId}:`, error);
    throw new Error(`Failed to estimate gas: ${error.message}`);
  }
}

/**
 * Execute USDT transfer on-chain with timeout protection
 * @param {string} toAddress - Recipient address
 * @param {number} amount - USDT amount
 * @param {number} chainId - Chain ID
 * @param {boolean} dryRun - Whether to skip actual transfer
 * @returns {Promise<Object>} Transaction result
 */
async function executeTransfer(toAddress, amount, chainId, dryRun = false) {
  try {
    // Validate inputs
    const normalizedAddress = validateAddress(toAddress);
    const contractAmount = amountToContractUnits(amount, chainId);
    const config = CHAIN_CONFIG[chainId];
    
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    // Check if dry run mode (only for CLI/testing, not for live server)
    if (dryRun && process.env.DRY_RUN === 'true') {
      console.log(`🔍 DRY RUN: Would transfer ${amount} USDT to ${normalizedAddress} on ${config.name}`);
      
      // Generate mock transaction hash
      const mockTxHash = "0xmock" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      
      return {
        success: true,
        txHash: mockTxHash,
        blockNumber: null,
        gasUsed: null,
        amount: amount,
        toAddress: normalizedAddress,
        chainId: chainId,
        dryRun: true
      };
    }
    
    // Get contract and estimate gas with timeout
    const contract = getUSDTContract(chainId);
    
    // Gas estimation with timeout
    const gasEstimate = await Promise.race([
      estimateTransferGas(normalizedAddress, amount, chainId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gas estimation timeout')), 10000)
      )
    ]);
    
    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate * 120n / 100n;
    
    console.log(`🚀 Executing transfer: ${amount} USDT to ${normalizedAddress} on ${config.name}`);
    console.log(`⛽ Gas estimate: ${gasEstimate.toString()}, Gas limit: ${gasLimit.toString()}`);
    
    // Execute transfer with timeout
    const tx = await Promise.race([
      contract.transfer(normalizedAddress, contractAmount, {
        gasLimit: gasLimit
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction submission timeout')), 15000)
      )
    ]);
    
    console.log(`📡 Transaction sent: ${tx.hash}`);
    
    // For Vercel serverless, don't wait for confirmation - return immediately
    // The transaction is submitted and will be confirmed on-chain
    // We can track it later via the transaction hash
    
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: null, // Will be null until confirmed
      gasUsed: null, // Will be null until confirmed
      amount: amount,
      toAddress: normalizedAddress,
      chainId: chainId,
      dryRun: false,
      status: 'submitted', // Transaction submitted but not yet confirmed
      message: 'Transaction submitted successfully. Confirmation pending.'
    };
    
  } catch (error) {
    console.error(`❌ Transfer failed on chain ${chainId}:`, error);
    
    // Handle specific error types
    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('Insufficient USDT balance in treasury');
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      throw new Error('Gas estimation failed - contract may be paused or invalid');
    } else if (error.code === 'NONCE_EXPIRED') {
      throw new Error('Transaction nonce expired - retry required');
    } else if (error.message.includes('user rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error.message.includes('timeout')) {
      throw new Error(`Transaction timeout: ${error.message}`);
    } else {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }
}

/**
 * Check transaction status and get confirmation details
 * @param {string} txHash - Transaction hash
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} Transaction status
 */
async function checkTransactionStatus(txHash, chainId) {
  try {
    const provider = getProvider(chainId);
    const config = CHAIN_CONFIG[chainId];
    
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        status: 'pending',
        txHash: txHash,
        chainId: chainId,
        message: 'Transaction is pending confirmation'
      };
    }
    
    return {
        status: 'confirmed',
        txHash: txHash,
        chainId: chainId,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        success: receipt.status === 1,
        message: receipt.status === 1 ? 'Transaction confirmed successfully' : 'Transaction failed'
    };
    
  } catch (error) {
    console.error(`Error checking transaction status for ${txHash} on chain ${chainId}:`, error);
    throw new Error(`Failed to check transaction status: ${error.message}`);
  }
}

/**
 * Get chain configuration
 * @param {number} chainId - Chain ID
 * @returns {Object} Chain configuration
 */
function getChainConfig(chainId) {
  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return { ...config }; // Return copy to prevent modification
}

/**
 * Validate chain configuration
 * @returns {Object} Validation result
 */
function validateChainConfiguration() {
  const results = {};
  
  for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
    const chainIdNum = parseInt(chainId);
    results[chainIdNum] = {
      chainId: chainIdNum,
      name: config.name,
      rpcUrl: !!config.rpcUrl,
      privateKey: !!config.privateKey,
      usdtAddress: !!config.usdtAddress,
      isValid: !!(config.rpcUrl && config.privateKey && config.usdtAddress)
    };
  }
  
  return results;
}

export {
  getProvider,
  getSigner,
  getUSDTContract,
  validateAddress,
  amountToContractUnits,
  contractUnitsToAmount,
  getTreasuryBalance,
  estimateTransferGas,
  executeTransfer,
  getChainConfig,
  validateChainConfiguration,
  checkTransactionStatus,
  CHAIN_CONFIG
};
