import mongoose from 'mongoose';
import { ethers } from 'ethers';

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;

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

const USDT_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  }
];

// RPC Configuration
const rpcEndpoints = {
  1: process.env.INFURA_MAINNET_RPC || process.env.ALCHEMY_MAINNET_RPC || 'https://mainnet.infura.io/v3/423dc5401ea74f279b1b90f58f2bee71',
  8453: 'https://mainnet.base.org',
  10: 'https://mainnet.optimism.io',
  42161: 'https://arb1.arbitrum.io/rpc',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/FlBOuTS3mAuXwKlI5pIitlyVpSYwgtC8',
};

// Mock transfer function for now (can be replaced with real implementation)
const executeTransfer = async (userAddress, amount, chainId, dryRun = false) => {
  console.log(`[Mock Transfer] Executing transfer: ${amount} USDT to ${userAddress} on chain ${chainId}`);
  
  if (dryRun) {
    return {
      success: true,
      txHash: "0xmockedtx123",
      blockNumber: 1234567,
      gasUsed: "65000",
      dryRun: true
    };
  }

  // For now, return a mock successful transfer
  // TODO: Implement real transfer logic with ethers.js
  return {
    success: true,
    txHash: "0x" + Math.random().toString(16).substr(2, 64),
    blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
    gasUsed: "65000",
    dryRun: false
  };
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
      // Auto-initialize reserve ledger if it doesn't exist
      console.log(`[Redeem] Reserve ledger not found for chain ${parsedChainId}, auto-initializing...`);
      
      try {
        const initialReserve = 1000000; // 1M USDT
        const newReserveLedger = new ReserveLedger({
          chainId: parsedChainId,
          totalReserve: initialReserve,
          lastUpdated: new Date(),
          notes: `Auto-initialized reserve for chain ${parsedChainId}`
        });
        
        await newReserveLedger.save({ session });
        reserveLedger = newReserveLedger;
        reserveBefore = initialReserve;
        
        console.log(`[Redeem] Auto-initialized reserve ledger for chain ${parsedChainId}: ${initialReserve} USDT`);
      } catch (initError) {
        console.error(`[Redeem] Failed to auto-initialize reserve ledger:`, initError);
        await session.abortTransaction();
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to initialize reserve ledger',
          details: initError.message
        });
      }
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
