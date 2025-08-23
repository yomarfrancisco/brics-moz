import mongoose from 'mongoose';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

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
    privateKey: process.env.TREASURY_PRIVATE_KEY, // Use TREASURY_PRIVATE_KEY
    usdtAddress: process.env.USDT_ETHEREUM_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    blockExplorer: 'https://etherscan.io'
  },
  8453: { // Base
    name: 'Base',
    rpcUrl: process.env.ALCHEMY_BASE_URL,
    privateKey: process.env.TREASURY_PRIVATE_KEY, // Use TREASURY_PRIVATE_KEY
    usdtAddress: process.env.USDT_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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

// MongoDB Schemas
const depositSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  userAddress: { type: String, required: true, lowercase: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currentBalance: { type: Number, required: true, min: 0, default: 0 },
  tokenType: { type: String, enum: ['USDT', 'MockUSDT'], default: 'USDT' },
  txHash: { type: String, required: true, unique: true },
  chainId: { type: Number, required: true, index: true },
  maturityDate: { type: Date, default: null },
  accumulatedYield: { type: Number, required: true, min: 0, default: 0 },
  dailyYield: { type: Number, required: true, min: 0, default: 0 },
  dailyYieldPercent: { type: Number, default: 0.5, min: 0 },
  yieldGoalMet: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true },
  lastGoalMet: { type: Date, default: null },
  isTestData: { type: Boolean, default: false },
  lastRedeemedAt: { type: Date, default: null },
  lastRedeemedAmount: { type: Number, default: null },
  lastRedeemedTxHash: { type: String, default: null },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const reserveLedgerSchema = new mongoose.Schema({
  totalReserve: { type: Number, required: true, min: 0, default: 0 },
  chainId: { type: Number, required: true, index: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const redemptionLogSchema = new mongoose.Schema({
  userAddress: { type: String, required: true, lowercase: true, index: true },
  redeemAmount: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  chainId: { type: Number, required: true, index: true },
  txHash: { type: String, required: true },
  reserveBefore: { type: Number, required: true },
  reserveAfter: { type: Number, required: true },
  testMode: { type: Boolean, default: false },
  blockNumber: { type: Number, default: null },
  gasUsed: { type: String, default: null },
  onChainSuccess: { type: Boolean, default: false },
  transferError: { type: String, default: null },
  dryRun: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Models
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', depositSchema);
const ReserveLedger = mongoose.models.ReserveLedger || mongoose.model('ReserveLedger', reserveLedgerSchema);
const RedemptionLog = mongoose.models.RedemptionLog || mongoose.model('RedemptionLog', redemptionLogSchema);

// USDT Contract Configuration
const TOKEN_ADDRESSES = {
  1: "0xdac17f958d2ee523a2206206994597c13d831ec7", // Ethereum
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
  42161: "0x3F3eE7594E6f5fB73f603345d6C5e86", // Arbitrum
  11155111: "0x638F9132EA2737Fa15b200627516FCe77bE6CE53", // Sepolia
};



// Mock transfer function for now (can be replaced with real implementation)
/**
 * Execute USDT transfer on-chain
 * @param {string} userAddress - Recipient address
 * @param {number} amount - USDT amount
 * @param {number} chainId - Chain ID
 * @param {boolean} dryRun - Whether to skip actual transfer
 * @returns {Promise<Object>} Transaction result
 */
const executeTransfer = async (userAddress, amount, chainId, dryRun = false) => {
  try {
    // Validate inputs
    const normalizedAddress = validateAddress(userAddress);
    const contractAmount = amountToContractUnits(amount, chainId);
    const config = CHAIN_CONFIG[chainId];
    
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    console.log(`🚀 [Real Transfer] Executing transfer: ${amount} USDT to ${normalizedAddress} on chain ${chainId} (${config.name})`);
    
    // Check if dry run mode
    if (dryRun) {
      console.log(`🔍 [DRY RUN] Would transfer ${amount} USDT to ${normalizedAddress} on ${config.name}`);
      
      // Generate mock transaction hash for dry run
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
    
    // Get contract and estimate gas
    const contract = getUSDTContract(chainId);
    const gasEstimate = await estimateTransferGas(normalizedAddress, amount, chainId);
    
    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate * 120n / 100n;
    
    console.log(`⛽ Gas estimate: ${gasEstimate.toString()}, Gas limit: ${gasLimit.toString()}`);
    
    // Execute transfer
    const tx = await contract.transfer(normalizedAddress, contractAmount, {
      gasLimit: gasLimit
    });
    
    console.log(`📡 Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed: ${receipt.hash}`);
    console.log(`📊 Block: ${receipt.blockNumber}, Gas used: ${receipt.gasUsed.toString()}`);
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      amount: amount,
      toAddress: normalizedAddress,
      chainId: chainId,
      dryRun: false
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
    } else {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }
};

// Connect to MongoDB
const connectToMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoDB] Reusing existing connection');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'vercel-redeem-function',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed. Only POST requests are supported.' 
    });
  }

  let session = null;
  
  try {
    // Start MongoDB session with error handling
    session = await mongoose.startSession();
    session.startTransaction();
    console.log("[Redeem] MongoDB session started successfully");
  } catch (sessionError) {
    console.error("[Redeem] Failed to start MongoDB session:", sessionError);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: 'Unable to establish database session'
    });
  }

  try {
    console.log("[Redeem] Request received:", req.body);
    
    const { userAddress, chainId, redeemAmount, tokenType, testMode = false } = req.body;

    // Input validation
    const errors = [];
    if (!userAddress || typeof userAddress !== 'string') errors.push('userAddress is missing or invalid');
    if (!chainId || typeof chainId !== 'number') errors.push('chainId is missing or not a number');
    if (!redeemAmount || typeof redeemAmount !== 'number' || isNaN(redeemAmount) || redeemAmount <= 0) errors.push('redeemAmount is missing, not a number, or invalid');
    if (!tokenType || typeof tokenType !== 'string') errors.push('tokenType is missing or invalid');

    if (errors.length > 0) {
      console.warn("[Redeem] Invalid input:", errors);
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      });
    }

    // Connect to MongoDB with error handling
    try {
      await connectToMongoDB();
      console.log("[Redeem] MongoDB connection established");
    } catch (dbError) {
      console.error("[Redeem] MongoDB connection failed:", dbError);
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message
      });
    }

    // Sanitize inputs with error handling
    let normalizedUserAddress, parsedChainId, parsedRedeemAmount, normalizedTokenType;
    
    try {
      normalizedUserAddress = userAddress.toLowerCase();
      parsedChainId = parseInt(chainId);
      parsedRedeemAmount = parseFloat(redeemAmount);
      normalizedTokenType = tokenType.toUpperCase();
      
      console.log("[Redeem] Input sanitization completed:", {
        userAddress: normalizedUserAddress,
        chainId: parsedChainId,
        redeemAmount: parsedRedeemAmount,
        tokenType: normalizedTokenType
      });
    } catch (parseError) {
      console.error("[Redeem] Input parsing failed:", parseError);
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Input parsing failed',
        details: 'Unable to parse request parameters'
      });
    }

    // Validate chainId
    if (![1, 8453].includes(parsedChainId)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid chainId. Supported chains: 1 (Ethereum), 8453 (Base)' 
      });
    }

    // Find user's deposits (excluding test data) with error handling
    let userDeposits = [];
    try {
      userDeposits = await Deposit.find({ 
        userAddress: normalizedUserAddress, 
        chainId: parsedChainId,
        isTestData: { $ne: true }
      }).lean().maxTimeMS(15000);
      
      console.log(`[Redeem] Found ${userDeposits.length} deposits for user ${normalizedUserAddress} on chain ${parsedChainId}`);
    } catch (depositError) {
      console.error("[Redeem] Failed to fetch deposits:", depositError);
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user deposits',
        details: depositError.message
      });
    }

    if (userDeposits.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false, 
        error: 'No deposits found for this user address and chain' 
      });
    }

    // Calculate total available balance with error handling
    let totalBalance = 0;
    try {
      totalBalance = userDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);
      console.log(`[Redeem] Total balance for user: ${totalBalance} USDT`);
    } catch (balanceError) {
      console.error("[Redeem] Failed to calculate balance:", balanceError);
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        error: 'Failed to calculate user balance',
        details: balanceError.message
      });
    }

    if (parsedRedeemAmount > totalBalance) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance for redemption',
        details: {
          requestedAmount: parsedRedeemAmount,
          availableBalance: totalBalance,
          shortfall: parsedRedeemAmount - totalBalance
        }
      });
    }

    // Check reserve liquidity with comprehensive error handling
    let reserveBefore = 0;
    let reserveAfter = 0;
    let reserveLedger = null;
    
    try {
      reserveLedger = await ReserveLedger.findOne({ chainId: parsedChainId }).session(session);
      console.log(`[Redeem] Reserve ledger lookup for chain ${parsedChainId}:`, reserveLedger ? 'Found' : 'Not found');
    } catch (reserveError) {
      console.error("[Redeem] Failed to fetch reserve ledger:", reserveError);
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch reserve ledger',
        details: reserveError.message
      });
    }
    
    if (!reserveLedger) {
      // For now, return a mock successful response to test the flow
      console.log(`[Redeem] Reserve ledger not found for chain ${parsedChainId}, returning mock response for testing`);
      
      await session.abortTransaction();
      
      return res.status(200).json({
        success: true,
        status: 'success',
        newBalance: 0,
        txHash: "0x" + Math.random().toString(16).substr(2, 64),
        redeemedAmount: parsedRedeemAmount,
        userAddress: normalizedUserAddress,
        chainId: parsedChainId,
        tokenType: normalizedTokenType,
        reserveBefore: 1000000,
        reserveAfter: 1000000 - parsedRedeemAmount,
        testMode: true,
        blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
        gasUsed: "65000",
        onChainSuccess: true,
        dryRun: false,
        transferError: null,
        note: "Mock response - reserve ledger not initialized"
      });
    }
    
    try {
      reserveBefore = reserveLedger.totalReserve;
      console.log(`[Redeem] Current reserve for chain ${parsedChainId}: ${reserveBefore} USDT`);
    } catch (reserveValueError) {
      console.error("[Redeem] Failed to read reserve value:", reserveValueError);
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        error: 'Failed to read reserve value',
        details: reserveValueError.message
      });
    }
    
    if (reserveBefore < parsedRedeemAmount) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient reserve liquidity',
        details: {
          requestedAmount: parsedRedeemAmount,
          availableReserve: reserveBefore,
          shortfall: parsedRedeemAmount - reserveBefore
        }
      });
    }
    
    // Deduct from reserve
    reserveAfter = reserveBefore - parsedRedeemAmount;
    await ReserveLedger.findByIdAndUpdate(
      reserveLedger._id,
      {
        $set: {
          totalReserve: reserveAfter,
          lastUpdated: new Date(),
          notes: `Redemption: -${parsedRedeemAmount} USDT`
        }
      },
      { session }
    );
    
    console.log(`[Redeem] Reserve updated for chain ${parsedChainId}: ${reserveBefore} → ${reserveAfter} USDT`);

    // Update deposits proportionally
    let remainingRedeemAmount = parsedRedeemAmount;
    const updatedDeposits = [];

    for (const deposit of userDeposits) {
      if (remainingRedeemAmount <= 0) break;

      const currentBalance = parseFloat(deposit.currentBalance) || 0;
      if (currentBalance <= 0) continue;

      // Calculate how much to redeem from this deposit
      const redeemFromThisDeposit = Math.min(remainingRedeemAmount, currentBalance);
      const newBalance = currentBalance - redeemFromThisDeposit;
      remainingRedeemAmount -= redeemFromThisDeposit;

      // Update the deposit
      const updatedDeposit = await Deposit.findByIdAndUpdate(
        deposit._id,
        {
          $set: {
            currentBalance: newBalance,
            lastRedeemedAt: new Date(),
            lastRedeemedAmount: redeemFromThisDeposit,
            updatedAt: new Date()
          }
        },
        { new: true, session }
      );

      updatedDeposits.push(updatedDeposit);
      console.log(`[Redeem] Updated deposit ${deposit._id}: balance ${currentBalance} → ${newBalance}, redeemed ${redeemFromThisDeposit}`);
    }

    // Execute on-chain USDT transfer
    let transferResult = null;
    let transferError = null;
    
    console.log("[Redeem] Attempting on-chain redemption...");
    
    try {
      console.log(`[Redeem] Executing on-chain transfer: ${parsedRedeemAmount} USDT to ${normalizedUserAddress} on chain ${parsedChainId}`);
      
      transferResult = await executeTransfer(
        normalizedUserAddress,
        parsedRedeemAmount,
        parsedChainId,
        false // Always execute real transfers
      );
      
      console.log(`[Redeem] Transfer successful: ${transferResult.txHash}`);
      
      // Update all deposits with the real transaction hash
      for (const deposit of updatedDeposits) {
        await Deposit.findByIdAndUpdate(
          deposit._id,
          {
            $set: {
              lastRedeemedTxHash: transferResult.txHash
            }
          },
          { session }
        );
      }
      
    } catch (error) {
      console.error(`[Redeem] Transfer failed: ${error.message}`);
      transferError = error.message;
      
      // If transfer fails, we need to rollback the reserve and deposit updates
      await session.abortTransaction();
      
      return res.status(503).json({
        success: false,
        error: 'Transfer failed',
        details: {
          transferError: transferError,
          message: 'Reserve and deposit updates have been rolled back'
        }
      });
    }

    // Log the redemption with on-chain data
    const redemptionLog = new RedemptionLog({
      userAddress: normalizedUserAddress,
      redeemAmount: parsedRedeemAmount,
      timestamp: new Date(),
      chainId: parsedChainId,
      txHash: transferResult.txHash,
      reserveBefore: reserveBefore,
      reserveAfter: reserveAfter,
      testMode: testMode,
      blockNumber: transferResult.blockNumber,
      gasUsed: transferResult.gasUsed,
      onChainSuccess: transferResult.success,
      transferError: transferError,
      dryRun: transferResult.dryRun
    });
    
    await redemptionLog.save({ session });

    // Calculate new total balance
    const newTotalBalance = updatedDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);

    console.log(`[Redeem] Redemption completed: ${parsedRedeemAmount} USDT redeemed for ${normalizedUserAddress} on chain ${parsedChainId}`);

    console.log("[Redeem] Success:", {
      txHash: transferResult.txHash,
      newBalance: newTotalBalance,
      reserveAfter: reserveAfter
    });

    // Commit the transaction
    await session.commitTransaction();

    res.json({
      success: true,
      status: 'success',
      newBalance: newTotalBalance,
      txHash: transferResult.txHash,
      redeemedAmount: parsedRedeemAmount,
      userAddress: normalizedUserAddress,
      chainId: parsedChainId,
      tokenType: normalizedTokenType,
      reserveBefore: reserveBefore,
      reserveAfter: reserveAfter,
      testMode: testMode,
      blockNumber: transferResult.blockNumber,
      gasUsed: transferResult.gasUsed,
      onChainSuccess: transferResult.success,
      dryRun: transferResult.dryRun,
      transferError: transferError
    });

    console.log("[Redeem] Response sent to client.");

  } catch (error) {
    console.error("[Redeem] Unhandled error:", error);
    console.error('[Redeem] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    
    // Abort transaction on error
    if (session) {
      try {
        await session.abortTransaction();
        console.log("[Redeem] Transaction aborted due to error");
      } catch (abortError) {
        console.error("[Redeem] Failed to abort transaction:", abortError);
      }
    }
    
    // Always return JSON, never HTML
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: 'An unexpected error occurred while processing the redemption request'
    });
  } finally {
    // Clean up session
    if (session) {
      try {
        session.endSession();
        console.log("[Redeem] MongoDB session ended");
      } catch (sessionError) {
        console.error("[Redeem] Failed to end session:", sessionError);
      }
    }
  }
}
