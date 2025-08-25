import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import { syncDepositsToSheet, syncWithdrawalsToSheet, updateYieldFromSheet, updateWithdrawalStatusFromSheet } from './sheets.js';
import cron from 'node-cron';
import { executeTransfer, validateChainConfiguration, getTreasuryBalance, checkTransactionStatus } from './usdt-contract.js';
import { google } from 'googleapis'; // Added
import { MongoClient } from 'mongodb';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const triggerSheetSync = async () => {
  try {
    const deposits = await Deposit.find({}).lean();
    const withdrawals = await Withdrawal.find({}).lean();
    await syncDepositsToSheet(deposits); // This now uses the updated logic
    await syncWithdrawalsToSheet(withdrawals);
    console.log('Successfully triggered sync to Google Sheets');
  } catch (error) {
    console.error('Error triggering sync to Google Sheets:', error);
  }
};

// Google Sheets Authentication
const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
if (Object.keys(credentials).length === 0) {
  console.warn('GOOGLE_SHEETS_CREDENTIALS is not set or empty');
}
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const app = express();

app.use('/api/withdraw', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
}));

// Update CORS middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://buybrics.vercel.app', 'https://docs.google.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

// Health check endpoint to verify backend is running
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend is alive!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodbConfigured: !!process.env.MONGODB_URI,
    infuraConfigured: !!process.env.INFURA_API_KEY,
    treasuryConfigured: !!process.env.TREASURY_PRIVATE_KEY
  });
});

// Environment check endpoint
app.get('/api/env-check', (req, res) => {
  const envCheck = {
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    variables: {
      NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
      INFURA_API_KEY: process.env.INFURA_API_KEY ? 'SET' : 'NOT_SET',
      TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY ? 'SET' : 'NOT_SET',
      ALCHEMY_BASE_URL: process.env.ALCHEMY_BASE_URL ? 'SET' : 'NOT_SET',
      USDT_ETHEREUM_ADDRESS: process.env.USDT_ETHEREUM_ADDRESS ? 'SET' : 'NOT_SET',
      USDT_BASE_ADDRESS: process.env.USDT_BASE_ADDRESS ? 'SET' : 'NOT_SET',
      GOOGLE_SHEETS_CREDENTIALS: process.env.GOOGLE_SHEETS_CREDENTIALS ? 'SET' : 'NOT_SET',
      GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID ? 'SET' : 'NOT_SET'
    },
    criticalMissing: [],
    status: 'OK'
  };

  // Check for critical missing variables
  if (!process.env.MONGODB_URI) {
    envCheck.criticalMissing.push('MONGODB_URI');
  }
  if (!process.env.INFURA_API_KEY) {
    envCheck.criticalMissing.push('INFURA_API_KEY');
  }
  if (!process.env.TREASURY_PRIVATE_KEY) {
    envCheck.criticalMissing.push('TREASURY_PRIVATE_KEY');
  }

  if (envCheck.criticalMissing.length > 0) {
    envCheck.status = 'MISSING_CRITICAL_VARS';
    envCheck.error = `Missing critical environment variables: ${envCheck.criticalMissing.join(', ')}`;
  }

  console.log('🔍 Environment Check Results:', {
    environment: envCheck.environment,
    criticalMissing: envCheck.criticalMissing,
    mongodbConfigured: !!process.env.MONGODB_URI,
    infuraConfigured: !!process.env.INFURA_API_KEY,
    treasuryConfigured: !!process.env.TREASURY_PRIVATE_KEY
  });

  res.json(envCheck);
});

// MongoDB connection test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      return res.status(500).json({ error: 'Missing MONGODB_URI in env' });
    }

    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('admin');
      const collections = await db.listCollections().toArray();
      res.status(200).json({ status: 'Connected', collections });
    } catch (err) {
      res.status(500).json({ error: 'Connection failed', details: err.message });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('❌ Test DB error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

console.log('Environment Variables:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  GOOGLE_SHEETS_CREDENTIALS_PATH: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ? 'Set' : 'Not set',
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID ? 'Set' : 'Not set',
});

// Log MongoDB URI (safely)
if (process.env.MONGODB_URI) {
  const uri = process.env.MONGODB_URI;
  const safeUri = uri.replace(/:([^@]+)@/, ':****@');
  console.log('MongoDB URI configured:', safeUri);
} else {
  console.error('❌ MONGODB_URI is NOT configured!');
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined. Please set it in environment variables.');
  // Don't exit in production, let the server start and handle errors gracefully
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

console.log('Connecting to MongoDB with URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

let mongooseConnection = null;
async function connectToMongoDB() {
  if (mongooseConnection) {
    console.log('Reusing existing MongoDB connection');
    return mongooseConnection;
  }
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined. Cannot connect to database.');
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    mongooseConnection = await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'ethers-cluster',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 30000, // Increased timeout
    });
    console.log('✅ MongoDB connected successfully');
    console.log('Database Name:', mongooseConnection.connection.db.databaseName);
    
    // List collections to verify connection
    try {
      const collections = await mongooseConnection.connection.db.listCollections().toArray();
      console.log('📋 Available collections:', collections.map(c => c.name));
    } catch (collectionError) {
      console.warn('⚠️ Could not list collections:', collectionError.message);
    }
    
    return mongooseConnection;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    });
    throw err; // Don't exit process, let the caller handle it
  }
}

app.use(async (req, res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (err) {
    console.error('Middleware MongoDB connection error:', err);
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

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
  dailyYieldPercent: { type: Number, default: 0.5, min: 0 }, // New field for percentage
  yieldGoalMet: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true },
  lastGoalMet: { type: Date, default: null },
  isTestData: { type: Boolean, default: false },
  // Redemption tracking fields
  lastRedeemedAt: { type: Date, default: null },
  lastRedeemedAmount: { type: Number, default: null },
  lastRedeemedTxHash: { type: String, default: null },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

depositSchema.index({ date: 1, userAddress: 1, chainId: 1 });

const withdrawalSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true }, // New field
  userAddress: { type: String, required: true, lowercase: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  availableBalance: { type: Number, required: true, min: 0, default: 0 },
  tokenType: { type: String, enum: ['USDT', 'MockUSDT'], default: 'USDT' },
  txHash: { type: String, required: true, unique: true },
  chainId: { type: Number, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  isTestData: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

withdrawalSchema.index({ date: 1, userAddress: 1, chainId: 1 });

const Deposit = mongoose.model('Deposit', depositSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// Reserve Ledger Schema
const reserveLedgerSchema = new mongoose.Schema({
  totalReserve: { type: Number, required: true, min: 0, default: 0 },
  chainId: { type: Number, required: true, index: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Redemption Log Schema
const redemptionLogSchema = new mongoose.Schema({
  userAddress: { type: String, required: true, lowercase: true, index: true },
  redeemAmount: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  chainId: { type: Number, required: true, index: true },
  txHash: { type: String, required: true },
  reserveBefore: { type: Number, required: true },
  reserveAfter: { type: Number, required: true },
  testMode: { type: Boolean, default: false },
  // On-chain transaction data
  blockNumber: { type: Number, default: null },
  gasUsed: { type: String, default: null },
  onChainSuccess: { type: Boolean, default: false },
  transferError: { type: String, default: null },
  dryRun: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const ReserveLedger = mongoose.model('ReserveLedger', reserveLedgerSchema);
const RedemptionLog = mongoose.model('RedemptionLog', redemptionLogSchema);

// RPC Configuration
const rpcEndpoints = {
  1: process.env.INFURA_MAINNET_RPC || process.env.ALCHEMY_MAINNET_RPC || 'https://mainnet.infura.io/v3/423dc5401ea74f279b1b90f58f2bee71', // Prefer Infura
  11155111: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/FlBOuTS3mAuXwKlI5pIitlyVpSYwgtC8', // Sepolia
  // Add other chains as needed (e.g., 8453, 10, 42161)
};

const getProvider = (chainId) => {
  const rpcUrl = rpcEndpoints[chainId] || rpcEndpoints[1]; // Default to Mainnet if chainId not found
  return new ethers.JsonRpcProvider(rpcUrl);
};

const TOKEN_ADDRESSES = {
  1: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  42161: "0x3F3eE7594E6f5fB73f603345d6C5e86",
  11155111: "0x638F9132EA2737Fa15b200627516FCe77bE6CE53",
};

const USDT_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
];

const DEPOSIT_CONTRACT_ADDRESS = '0x02191A9b285b72907624014ed0b4e62d89Dfb881';
const DEPOSIT_CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_treasury", "type": "address" },
      { "internalType": "address", "name": "_usdtToken", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Deposit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "treasury", "type": "address" }
    ],
    "name": "Withdrawal",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "usdtToken",
    "outputs": [
      { "internalType": "contract IERC20", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Update provider for depositContract based on chainId
const depositContract = (chainId) => new ethers.Contract(DEPOSIT_CONTRACT_ADDRESS, DEPOSIT_CONTRACT_ABI, getProvider(chainId));

depositContract(11155111).on('Deposit', async (user, amount, event) => {
  try {
    const chainId = 11155111;
    console.log(`Deposit event detected on Sepolia: User=${user}, Amount=${amount.toString()}, TxHash=${event.transactionHash}`);

    const formattedAmount = Number(ethers.formatUnits(amount, 6));
    const deposit = new Deposit({
      userAddress: user.toLowerCase(),
      amount: formattedAmount,
      txHash: event.transactionHash,
      chainId: chainId,
      tokenType: 'MockUSDT',
      currentBalance: formattedAmount,
      isTestData: false,
    });

    await deposit.save();
    console.log(`Saved Mock USDT deposit on Sepolia: ${formattedAmount} USDT for ${user}`);
  } catch (error) {
    console.error('Error saving Mock USDT deposit event:', error);
  }
});

console.log('Setting up Express routes...');

app.get('/api/health', (req, res) => {
  console.log('Health endpoint hit');
  res.json({ status: 'healthy' });
});

app.get('/api/deposits/:userAddress', async (req, res) => {
  try {
    const userAddress = req.params.userAddress.toLowerCase();
    console.log('🔍 Fetching deposits for:', userAddress);
    
    // Ensure we have a database connection
    if (!mongoose.connection.readyState) {
      console.error('❌ Database not connected');
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available',
        details: 'Backend is not properly initialized'
      });
    }
    
    const deposits = await Deposit.find({ userAddress }).lean().maxTimeMS(15000);
    console.log('💰 Deposits found:', deposits.length);

    const withdrawals = await Withdrawal.find({ userAddress }).lean().maxTimeMS(15000);
    console.log('💸 Withdrawals found:', withdrawals.length);

    const usdtDeposits = deposits.filter(d => d.tokenType === 'USDT' && d.chainId !== 11155111);
    const mockUsdtDeposits = deposits.filter(d => d.tokenType === 'MockUSDT' && d.chainId === 11155111);
    const usdtWithdrawals = withdrawals.filter(w => w.chainId !== 11155111);
    const mockUsdtWithdrawals = withdrawals.filter(w => w.chainId === 11155111);

    const totalUsdtDeposited = usdtDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const totalMockUsdtDeposited = mockUsdtDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const totalUsdtWithdrawn = usdtWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const totalMockUsdtWithdrawn = mockUsdtWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    const netUsdtDeposited = totalUsdtDeposited - totalUsdtWithdrawn;
    const netMockUsdtDeposited = totalMockUsdtDeposited - totalMockUsdtWithdrawn;

    console.log('📊 Balance summary:', {
      userAddress,
      totalUsdtDeposited: netUsdtDeposited,
      totalMockUsdtDeposited: netMockUsdtDeposited,
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length
    });

    res.json({
      success: true,
      deposits,
      withdrawals,
      totalUsdtDeposited: netUsdtDeposited,
      totalMockUsdtDeposited: netMockUsdtDeposited,
    });
  } catch (error) {
    console.error('❌ Error in deposits API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/deposits/tx/:txHash', async (req, res) => {
  try {
    const txHash = req.params.txHash.toLowerCase();
    console.log('Fetching deposit for txHash:', txHash);
    const deposit = await Deposit.findOne({ txHash }).lean().maxTimeMS(15000);
    console.log('Deposit found:', deposit);
    res.json({ success: true, deposit });
  } catch (error) {
    console.error('Error fetching deposit by txHash:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deposit' });
  }
});

app.post('/api/deposits', async (req, res) => {
  try {
    const { userAddress, amount, txHash, chainId, yieldGoalMet } = req.body;
    console.log(`Saving deposit with payload:`, { userAddress, amount, txHash, chainId, yieldGoalMet });

    const errors = [];
    if (!userAddress || typeof userAddress !== 'string') errors.push('userAddress is missing or invalid');
    if (!amount || typeof amount !== 'number' || isNaN(amount) || amount <= 0) errors.push('amount is missing, not a number, or invalid');
    if (!txHash || typeof txHash !== 'string') errors.push('txHash is missing or invalid');
    if (!chainId || typeof chainId !== 'number') errors.push('chainId is missing or not a number');

    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }

    const normalizedTxHash = txHash.toLowerCase();
    const existingDeposit = await Deposit.findOne({ txHash: normalizedTxHash }).lean().maxTimeMS(15000);
    if (existingDeposit) {
      console.log(`Duplicate txHash found: ${normalizedTxHash}`);
      return res.status(400).json({ success: false, error: 'Duplicate transaction hash', txHash: normalizedTxHash, existingDeposit });
    }

    const normalizedUserAddress = userAddress.toLowerCase();
    const parsedChainId = parseInt(chainId);
    const parsedAmount = parseFloat(amount);
    const transactionDate = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

    // 🔧 FIX: Prevent suspiciously large deposits
    if (parsedAmount > 10) {
      console.warn(`⚠️ Large deposit detected: ${parsedAmount} USDT for ${normalizedUserAddress}`);
      // For now, allow but log for manual review
      // TODO: Implement ALLOW_LARGE_DEPOSITS flag for production
    }

    // Fetch existing deposits for this user on this chain
    const existingDeposits = await Deposit.find({ userAddress: normalizedUserAddress, chainId: parsedChainId }).lean().maxTimeMS(15000);
    
    // 🔧 FIX: Use original amount for currentBalance, not cumulative sum
    const newTotalBalance = parsedAmount; // Each deposit should have its own amount as currentBalance
    
    // Calculate daily yield (0.5% of amount if yieldGoalMet is true)
    const dailyYield = yieldGoalMet ? parsedAmount * 0.005 : 0; // 0.5% yield
    // Calculate accumulated yield (sum of daily yields where goal was met)
    const accumulatedYield = existingDeposits.reduce((sum, deposit) => sum + (deposit.yieldGoalMet ? deposit.dailyYield : 0), 0) + dailyYield;

    const deposit = new Deposit({
      date: transactionDate,
      userAddress: normalizedUserAddress,
      amount: parsedAmount,
      currentBalance: newTotalBalance,
      tokenType: chainId === 11155111 ? 'MockUSDT' : 'USDT',
      txHash: normalizedTxHash,
      chainId: parsedChainId,
      maturityDate: null,
      accumulatedYield: accumulatedYield,
      dailyYield: dailyYield,
      yieldGoalMet: yieldGoalMet || false,
      timestamp: new Date(),
      lastGoalMet: yieldGoalMet ? new Date() : null,
      isTestData: false,
    });

    let saveAttempts = 0;
    const maxAttempts = 3;
    while (saveAttempts < maxAttempts) {
      try {
        await deposit.save();
        // 🔧 FIX: Remove the updateMany that was corrupting all previous deposits
        // await Deposit.updateMany(
        //   { userAddress: normalizedUserAddress, chainId: parsedChainId, txHash: { $ne: normalizedTxHash } },
        //   { $set: { currentBalance: newTotalBalance } }
        // );
        await triggerSheetSync();
        return res.json({
          success: true,
          deposit,
          totalUsdtDeposited: 0, // Update with actual logic if needed
          totalMockUsdtDeposited: 0, // Update with actual logic if needed
        });
      } catch (saveError) {
        console.error(`MongoDB save error (attempt ${saveAttempts + 1}):`, saveError);
        if (saveError.code === 11000) {
          const doubleCheck = await Deposit.findOne({ txHash: normalizedTxHash }).lean().maxTimeMS(15000);
          if (doubleCheck) return res.status(400).json({ success: false, error: 'Duplicate transaction hash', txHash: normalizedTxHash });
          saveAttempts++;
          continue;
        }
        throw saveError;
      }
    }
    return res.status(500).json({ success: false, error: 'Failed to save deposit after retries' });
  } catch (error) {
    console.error('Error saving deposit:', error);
    res.status(500).json({ success: false, error: `Failed to save deposit: ${error.message}` });
  }
});

app.put('/api/deposits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { yieldGoalMet } = req.body;

    const deposit = await Deposit.findById(id);
    if (!deposit) return res.status(404).json({ success: false, error: 'Deposit not found' });

    const previousDailyYield = deposit.dailyYield;
    const newDailyYield = yieldGoalMet ? deposit.amount * 0.005 : 0;
    const yieldDifference = newDailyYield - previousDailyYield;

    deposit.yieldGoalMet = yieldGoalMet;
    deposit.dailyYield = newDailyYield;
    deposit.accumulatedYield += yieldDifference;
    deposit.lastGoalMet = yieldGoalMet ? new Date() : null;

    await deposit.save();
    await triggerSheetSync();
    res.json({ success: true, deposit });
  } catch (error) {
    console.error('Error updating deposit:', error);
    res.status(500).json({ success: false, error: `Failed to update deposit: ${error.message}` });
  }
});

// DEPRECATED: Legacy withdrawal endpoint
// REPLACED BY: /api/redeem endpoint (line 686)
// TODO: Remove this endpoint in next major version
app.post('/api/withdraw', async (req, res) => {
  try {
    const { userAddress, amount, chainId, txHash } = req.body;
    console.log(`Processing withdrawal for ${userAddress}: ${amount} USDT on chain ${chainId}, txHash: ${txHash}`);

    const errors = [];
    if (!userAddress || typeof userAddress !== 'string') errors.push('userAddress is missing or invalid');
    if (!amount || typeof amount !== 'number' || isNaN(amount) || amount <= 0) errors.push('amount is missing, not a number, or invalid');
    if (!chainId || typeof chainId !== 'number') errors.push('chainId is missing or not a number');
    if (!txHash || typeof txHash !== 'string') errors.push('txHash is missing or invalid');

    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
    }

    const normalizedUserAddress = userAddress.toLowerCase();
    const parsedChainId = parseInt(chainId);
    const parsedAmount = parseFloat(amount);
    const normalizedTxHash = txHash.toLowerCase();
    const transactionDate = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

    const existingWithdrawal = await Withdrawal.findOne({ txHash: normalizedTxHash }).lean().maxTimeMS(15000);
    if (existingWithdrawal) {
      console.log(`Duplicate txHash found: ${normalizedTxHash}`);
      return res.status(400).json({ success: false, error: 'Duplicate transaction hash', txHash: normalizedTxHash, existingWithdrawal });
    }

    const deposits = await Deposit.find({ userAddress: normalizedUserAddress, chainId: parsedChainId }).lean().maxTimeMS(15000);
    const withdrawals = await Withdrawal.find({ userAddress: normalizedUserAddress, chainId: parsedChainId }).lean().maxTimeMS(15000);
    const totalDeposited = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const totalWithdrawnSoFar = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    const availableFunds = totalDeposited - totalWithdrawnSoFar;

    if (parsedAmount > availableFunds) {
      console.log('Withdrawal amount exceeds available funds');
      return res.status(400).json({ success: false, error: 'Withdrawal amount exceeds available funds' });
    }

    const newCurrentBalance = availableFunds - parsedAmount;

    // Save the withdrawal
    const withdrawal = new Withdrawal({
      date: transactionDate,
      userAddress: normalizedUserAddress,
      amount: parsedAmount,
      availableBalance: newCurrentBalance,
      tokenType: chainId === 11155111 ? 'MockUSDT' : 'USDT',
      txHash: normalizedTxHash,
      chainId: parsedChainId,
      timestamp: new Date(),
      status: 'Pending',
      isTestData: false,
    });

    let saveAttempts = 0;
    const maxAttempts = 3;
    while (saveAttempts < maxAttempts) {
      try {
        await withdrawal.save();
        console.log(`Withdrawal recorded successfully: ${JSON.stringify(withdrawal)}`);

        // Update currentBalance of all deposits for this user on this chain
        await Deposit.updateMany(
          { userAddress: normalizedUserAddress, chainId: parsedChainId },
          { $set: { currentBalance: newCurrentBalance } }
        );
        console.log(`Updated currentBalance to ${newCurrentBalance} for all deposits of ${normalizedUserAddress} on chain ${parsedChainId}`);

        const updatedDeposits = await Deposit.find({ userAddress: normalizedUserAddress }).lean().maxTimeMS(15000);
        const updatedWithdrawals = await Withdrawal.find({ userAddress: normalizedUserAddress }).lean().maxTimeMS(15000);

        const usdtDeposits = updatedDeposits.filter(d => d.tokenType === 'USDT' && d.chainId !== 11155111);
        const mockUsdtDeposits = updatedDeposits.filter(d => d.tokenType === 'MockUSDT' && d.chainId === 11155111);
        const usdtWithdrawals = updatedWithdrawals.filter(w => w.chainId !== 11155111);
        const mockUsdtWithdrawals = updatedWithdrawals.filter(w => w.chainId === 11155111);

        const totalUsdtDeposited = usdtDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
        const totalMockUsdtDeposited = mockUsdtDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
        const totalUsdtWithdrawn = usdtWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
        const totalMockUsdtWithdrawn = mockUsdtWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

        const netUsdtDeposited = totalUsdtDeposited - totalUsdtWithdrawn;
        const netMockUsdtDeposited = totalMockUsdtDeposited - totalMockUsdtWithdrawn;

        await triggerSheetSync();

        return res.json({
          success: true,
          withdrawal: { txHash: normalizedTxHash },
          totalUsdtDeposited: netUsdtDeposited,
          totalMockUsdtDeposited: netMockUsdtDeposited,
        });
      } catch (saveError) {
        console.error(`MongoDB save error (attempt ${saveAttempts + 1}):`, {
          message: saveError.message,
          code: saveError.code,
          name: saveError.name,
          stack: saveError.stack,
        });

        if (saveError.code === 11000) {
          const doubleCheck = await Withdrawal.findOne({ txHash: normalizedTxHash }).lean().maxTimeMS(15000);
          if (doubleCheck) {
            console.log(`Confirmed duplicate txHash: ${normalizedTxHash}`);
            return res.status(400).json({ success: false, error: 'Duplicate transaction hash', txHash: normalizedTxHash, existingWithdrawal: doubleCheck });
          }
          saveAttempts++;
          console.log(`Retrying save attempt ${saveAttempts + 1} for txHash: ${normalizedTxHash}`);
          continue;
        } else if (saveError.message.includes('index') || saveError.message.includes('unique')) {
          console.error('Possible missing txHash index. Run: db.withdrawals.createIndex({ txHash: 1 }, { unique: true })');
          return res.status(500).json({
            success: false,
            error: 'Database index error',
            suggestion: 'Create unique index on txHash: db.withdrawals.createIndex({ txHash: 1 }, { unique: true })',
          });
        }
        throw saveError;
      }
    }

    console.error(`Failed to save withdrawal after ${maxAttempts} attempts`);
    return res.status(500).json({ success: false, error: 'Failed to save withdrawal after retries' });
  } catch (error) {
    console.error('Error processing withdrawal:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    res.status(500).json({ success: false, error: `Failed to process withdrawal: ${error.message}` });
  }
});

app.post('/api/sync/sheets', async (req, res) => {
  try {
    const deposits = await Deposit.find({}).lean();
    const withdrawals = await Withdrawal.find({}).lean();
    await syncDepositsToSheet(deposits);
    await syncWithdrawalsToSheet(withdrawals);
    res.json({ success: true, message: 'Synced to Google Sheets' });
  } catch (error) {
    console.error('Error syncing to Sheets:', error);
    res.status(500).json({ success: false, error: 'Failed to sync to Sheets' });
  }
});

app.post('/api/update/from-sheets', async (req, res) => {
  try {
    const yieldUpdates = await updateYieldFromSheet();
    for (const update of yieldUpdates) {
      const { userAddress, chainId, accumulatedYield, dailyYield, dailyYieldPercent, currentBalance, lastGoalMet } = update;
      await Deposit.updateOne(
        { userAddress: userAddress.toLowerCase(), chainId },
        {
          $set: {
            accumulatedYield,
            dailyYield,
            dailyYieldPercent,
            currentBalance,
            lastGoalMet: lastGoalMet || new Date(), // Update lastGoalMet if provided
            updatedAt: new Date(),
          },
        },
        { upsert: false }
      );
      console.log(`Updated deposit for ${userAddress} on chain ${chainId}: balance=${currentBalance}, yield=${accumulatedYield}, dailyYield=${dailyYield}, dailyYieldPercent=${dailyYieldPercent}%`);
    }

    const withdrawalUpdates = await updateWithdrawalStatusFromSheet();
    for (const update of withdrawalUpdates) {
      await Withdrawal.updateOne(
        { txHash: update.txHash },
        { $set: { status: update.status, availableBalance: update.availableBalance, updatedAt: new Date() } },
        { upsert: false }
      );
      console.log(`Updated withdrawal for txHash ${update.txHash}: status=${update.status}`);
    }

    // Trigger sheet sync to ensure consistency, but preserve manual changes
    await triggerSheetSync();

    res.json({ success: true, message: 'Updated from Google Sheets' });
  } catch (error) {
    console.error('Error updating from Sheets:', error);
    res.status(500).json({ success: false, error: 'Failed to update from Sheets' });
  }
});

// Redeem route for USDT balance redemption with timeout protection
app.post('/api/redeem', async (req, res) => {
  // Set a timeout for the entire request
  const requestTimeout = setTimeout(() => {
    console.error("❌ Request timeout - sending error response");
    res.status(504).json({
      success: false,
      error: 'Request timeout',
      message: 'The redemption request took too long to process. Please try again.',
      code: 'TIMEOUT'
    });
  }, 25000); // 25 second timeout

  let session = null;
  
  try {
    console.log("📥 Received redemption request:", req.body);
    
    const { userAddress, chainId, redeemAmount, tokenType, testMode = false } = req.body;
    console.log(`Processing redemption request:`, { userAddress, chainId, redeemAmount, tokenType, testMode });

    // Input validation
    const errors = [];
    if (!userAddress || typeof userAddress !== 'string') errors.push('userAddress is missing or invalid');
    if (!chainId || typeof chainId !== 'number') errors.push('chainId is missing or not a number');
    if (!redeemAmount || typeof redeemAmount !== 'number' || isNaN(redeemAmount) || redeemAmount <= 0) errors.push('redeemAmount is missing, not a number, or invalid');
    if (!tokenType || typeof tokenType !== 'string') errors.push('tokenType is missing or invalid');

    if (errors.length > 0) {
      console.warn("⚠️ Invalid redemption input");
      console.error('Validation errors:', errors);
      clearTimeout(requestTimeout);
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }

    // Sanitize inputs
    const normalizedUserAddress = userAddress.toLowerCase();
    const parsedChainId = parseInt(chainId);
    const parsedRedeemAmount = parseFloat(redeemAmount);
    const normalizedTokenType = tokenType.toUpperCase();

    // Validate chainId
    if (![1, 8453].includes(parsedChainId)) {
      clearTimeout(requestTimeout);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid chainId. Supported chains: 1 (Ethereum), 8453 (Base)',
        code: 'INVALID_CHAIN'
      });
    }

    // Start MongoDB session with timeout
    session = await mongoose.startSession();
    session.startTransaction();
    console.log("[Redeem] MongoDB session started successfully");

    // Find user's deposits (excluding test data) with timeout
    const userDeposits = await Promise.race([
      Deposit.find({ 
        userAddress: normalizedUserAddress, 
        chainId: parsedChainId,
        isTestData: { $ne: true }
      }).lean().maxTimeMS(10000),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
    ]);

    if (userDeposits.length === 0) {
      await session.abortTransaction();
      clearTimeout(requestTimeout);
      return res.status(404).json({ 
        success: false, 
        error: 'No deposits found for this user address and chain',
        code: 'NO_DEPOSITS'
      });
    }

    // Calculate total available balance
    const totalBalance = userDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);

    if (parsedRedeemAmount > totalBalance) {
      await session.abortTransaction();
      clearTimeout(requestTimeout);
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance for redemption',
        details: {
          requestedAmount: parsedRedeemAmount,
          availableBalance: totalBalance,
          shortfall: parsedRedeemAmount - totalBalance
        },
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    // Check reserve liquidity with timeout
    let reserveBefore = 0;
    let reserveAfter = 0;
    
    const reserveLedger = await Promise.race([
      ReserveLedger.findOne({ chainId: parsedChainId }).session(session),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Reserve query timeout')), 10000)
      )
    ]);
    
    if (!reserveLedger) {
      // Auto-initialize reserve ledger if missing
      console.log(`[Redeem] Reserve ledger not found for chain ${parsedChainId}, auto-initializing...`);
      
      try {
        const chainName = parsedChainId === 1 ? 'Ethereum Mainnet' : parsedChainId === 8453 ? 'Base' : `Chain ${parsedChainId}`;
        const initialReserve = 1000000; // 1M USDT initial reserve
        
        const newReserveLedger = new ReserveLedger({
          chainId: parsedChainId,
          totalReserve: initialReserve,
          lastUpdated: new Date(),
          notes: `Auto-initialized reserve for ${chainName} - Production Ready`
        });
        
        await newReserveLedger.save({ session });
        reserveBefore = initialReserve;
        console.log(`[Redeem] Reserve ledger auto-initialized for chain ${parsedChainId}: ${initialReserve} USDT`);
      } catch (initError) {
        console.error(`[Redeem] Failed to auto-initialize reserve ledger:`, initError);
        await session.abortTransaction();
        clearTimeout(requestTimeout);
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize reserve ledger',
          details: initError.message,
          code: 'RESERVE_INIT_ERROR'
        });
      }
    } else {
      reserveBefore = reserveLedger.totalReserve;
    }
    
    if (reserveBefore < parsedRedeemAmount) {
      await session.abortTransaction();
      clearTimeout(requestTimeout);
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient reserve liquidity',
        details: {
          requestedAmount: parsedRedeemAmount,
          availableReserve: reserveBefore,
          shortfall: parsedRedeemAmount - reserveBefore
        },
        code: 'INSUFFICIENT_RESERVE'
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
    
    console.log(`Reserve updated for chain ${parsedChainId}: ${reserveBefore} → ${reserveAfter} USDT`);

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
      console.log(`Updated deposit ${deposit._id}: balance ${currentBalance} → ${newBalance}, redeemed ${redeemFromThisDeposit}`);
    }

    // Execute on-chain USDT transfer with timeout protection
    let transferResult = null;
    let transferError = null;
    
    console.log("🔁 Attempting on-chain redemption...");
    
    try {
      console.log(`🔄 Executing on-chain transfer: ${parsedRedeemAmount} USDT to ${normalizedUserAddress} on chain ${parsedChainId}`);
      
      // Execute transfer with timeout
      transferResult = await Promise.race([
        executeTransfer(
          normalizedUserAddress,
          parsedRedeemAmount,
          parsedChainId,
          false
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transfer execution timeout')), 20000)
        )
      ]);
      
      console.log(`✅ Transfer submitted: ${transferResult.txHash}`);
      
      // Update all deposits with the transaction hash
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
      console.error(`❌ Transfer failed: ${error.message}`);
      transferError = error.message;
      
      // If transfer fails, rollback the reserve and deposit updates
      await session.abortTransaction();
      clearTimeout(requestTimeout);
      
      return res.status(503).json({
        success: false,
        error: 'Transfer failed',
        details: {
          transferError: transferError,
          message: 'Reserve and deposit updates have been rolled back'
        },
        code: 'TRANSFER_ERROR'
      });
    }

    // Log the redemption
    const redemptionLog = new RedemptionLog({
      userAddress: normalizedUserAddress,
      redeemAmount: parsedRedeemAmount,
      timestamp: new Date(),
      chainId: parsedChainId,
      txHash: transferResult.txHash,
      reserveBefore: reserveBefore,
      reserveAfter: reserveAfter,
      testMode: false,
      blockNumber: transferResult.blockNumber,
      gasUsed: transferResult.gasUsed,
      onChainSuccess: transferResult.success,
      transferError: transferError,
      dryRun: transferResult.dryRun
    });
    
    await redemptionLog.save({ session });

    // Calculate new total balance
    const newTotalBalance = updatedDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);

    console.log(`Redemption completed: ${parsedRedeemAmount} USDT redeemed for ${normalizedUserAddress} on chain ${parsedChainId}`);

    // Commit the transaction
    await session.commitTransaction();
    clearTimeout(requestTimeout);

    console.log("✅ Redemption success:", {
      txHash: transferResult.txHash,
      newBalance: newTotalBalance,
      reserveAfter: reserveAfter
    });

    res.json({
      success: true,
      status: transferResult.status || 'submitted',
      newBalance: newTotalBalance,
      txHash: transferResult.txHash,
      redeemedAmount: parsedRedeemAmount,
      userAddress: normalizedUserAddress,
      chainId: parsedChainId,
      tokenType: normalizedTokenType,
      reserveBefore: reserveBefore,
      reserveAfter: reserveAfter,
      testMode: false,
      blockNumber: transferResult.blockNumber,
      gasUsed: transferResult.gasUsed,
      onChainSuccess: transferResult.success,
      dryRun: transferResult.dryRun,
      transferError: transferError,
      message: transferResult.message || 'Redemption processed successfully'
    });

    console.log("📦 Response sent to client.");

  } catch (error) {
    console.error("❌ Redemption error:", error);
    console.error('Error processing redemption:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    
    // Abort transaction on error
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Failed to abort transaction:", abortError);
      }
    }
    
    clearTimeout(requestTimeout);
    
    // Always return JSON, never HTML
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the redemption request',
      details: error.message,
      code: 'INTERNAL_ERROR'
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
});

// Transaction status check endpoint
app.get('/api/transaction-status/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const { chainId } = req.query;
    
    if (!txHash || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        details: 'Both txHash and chainId are required',
        code: 'MISSING_PARAMS'
      });
    }
    
    const parsedChainId = parseInt(chainId);
    if (![1, 8453].includes(parsedChainId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chainId',
        details: 'Supported chains: 1 (Ethereum), 8453 (Base)',
        code: 'INVALID_CHAIN'
      });
    }
    
    console.log(`Checking transaction status: ${txHash} on chain ${parsedChainId}`);
    
    const status = await checkTransactionStatus(txHash, parsedChainId);
    
    res.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    console.error('Error checking transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check transaction status',
      details: error.message,
      code: 'STATUS_CHECK_ERROR'
    });
  }
});

// Cleanup endpoint to remove fake and inflated deposits
app.post('/api/cleanup-fake-deposits', async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of fake and inflated deposits...');
    
    // 1. Find and analyze suspicious deposits
    console.log('📊 Analyzing deposits for suspicious patterns...');
    
    const suspiciousDeposits = await Deposit.find({
      $or: [
        { amount: { $gte: 100 } }, // Large deposits
        { txHash: { $in: [null, "", "0x", "test", "mock", "0xmainnettest123", "0xmainnettest456"] } }, // Missing or fake tx hashes
        { currentBalance: { $gte: 100 } } // Inflated balances
      ]
    }).lean();
    
    console.log(`Found ${suspiciousDeposits.length} suspicious deposits`);
    
    // 2. Clean up specific fake deposits
    console.log('🗑️ Cleaning up fake deposits...');
    
    // Remove the specific fake $100 deposit
    const fake100Result = await Deposit.deleteOne({
      userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
      amount: 100
    });
    
    console.log(`✅ Removed ${fake100Result.deletedCount} fake $100 deposit(s)`);
    
    // Remove deposits with missing or fake transaction hashes
    const fakeTxResult = await Deposit.deleteMany({
      txHash: { $in: [null, "", "0x", "test", "mock", "0xmainnettest123", "0xmainnettest456"] }
    });
    
    console.log(`✅ Removed ${fakeTxResult.deletedCount} deposits with fake transaction hashes`);
    
    // Remove deposits where currentBalance is significantly inflated (>10x the amount)
    const inflatedResult = await Deposit.deleteMany({
      $expr: {
        $and: [
          { $gt: ["$currentBalance", 10] },
          { $lt: ["$amount", 1] },
          { $gt: [{ $divide: ["$currentBalance", "$amount"] }, 10] }
        ]
      }
    });
    
    console.log(`✅ Removed ${inflatedResult.deletedCount} deposits with inflated balances`);
    
    // 3. Verify cleanup
    console.log('🔍 Verifying cleanup...');
    
    const remainingDeposits = await Deposit.find({
      userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1"
    }).lean();
    
    console.log(`📊 Remaining deposits for test wallet: ${remainingDeposits.length}`);
    
    // 4. Summary
    const totalRemaining = await Deposit.countDocuments();
    console.log(`✅ Cleanup completed! Total deposits remaining: ${totalRemaining}`);
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      removed: {
        fake100: fake100Result.deletedCount,
        fakeTx: fakeTxResult.deletedCount,
        inflated: inflatedResult.deletedCount
      },
      remaining: {
        testWallet: remainingDeposits.length,
        total: totalRemaining
      },
      suspiciousDeposits: suspiciousDeposits.map(d => ({
        userAddress: d.userAddress,
        amount: d.amount,
        currentBalance: d.currentBalance,
        txHash: d.txHash,
        timestamp: d.timestamp
      }))
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    });
  }
});


cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled sync to Google Sheets at 00:00...');
  try {
    const deposits = await Deposit.find({}).lean();
    const withdrawals = await Withdrawal.find({}).lean();
    await syncDepositsToSheet(deposits);
    await syncWithdrawalsToSheet(withdrawals);
    console.log('Scheduled sync to Google Sheets completed successfully');
  } catch (error) {
    console.error('Error during scheduled sync to Google Sheets:', error);
  }
}, {
  scheduled: true,
  timezone: 'UTC'
});

console.log('Scheduled task for /api/sync/sheets set to run daily at 00:00 UTC');

// Reserve status endpoint
app.get('/api/reserve-status', async (req, res) => {
  try {
    const reserves = await ReserveLedger.find({}).lean();
    const chainReserves = {};
    let totalReserve = 0;
    
    reserves.forEach(reserve => {
      chainReserves[reserve.chainId] = { totalReserve: reserve.totalReserve };
      totalReserve += reserve.totalReserve;
    });
    
    res.json({
      success: true,
      totalReserve: totalReserve,
      chainReserves: chainReserves
    });
  } catch (error) {
    console.error('Error fetching reserve status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reserve status' });
  }
});

// Data integrity check endpoint
app.get('/api/check-user-data', async (req, res) => {
  try {
    const userAddress = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
    const normalizedAddress = userAddress.toLowerCase();

    // Check deposits
    const deposits = await Deposit.find({ userAddress: normalizedAddress }).lean();
    
    // Check withdrawals
    const withdrawals = await Withdrawal.find({ userAddress: normalizedAddress }).lean();

    // Analyze data integrity
    const depositIssues = [];
    const withdrawalIssues = [];

    deposits.forEach((deposit, index) => {
      const issues = [];
      if (deposit.amount === null || deposit.amount === undefined) issues.push('NULL amount');
      if (deposit.chainId === null || deposit.chainId === undefined) issues.push('NULL chainId');
      if (deposit.txHash && deposit.txHash.length > 100) issues.push('TX hash too long');
      if (deposit.timestamp && isNaN(new Date(deposit.timestamp))) issues.push('Invalid timestamp');
      if (deposit.amount && (isNaN(deposit.amount) || deposit.amount < 0)) issues.push('Invalid amount');
      if (deposit.currentBalance && (isNaN(deposit.currentBalance) || deposit.currentBalance < 0)) issues.push('Invalid currentBalance');
      
      if (issues.length > 0) {
        depositIssues.push({
          index: index + 1,
          id: deposit._id,
          issues: issues
        });
      }
    });

    withdrawals.forEach((withdrawal, index) => {
      const issues = [];
      if (withdrawal.amount === null || withdrawal.amount === undefined) issues.push('NULL amount');
      if (withdrawal.chainId === null || withdrawal.chainId === undefined) issues.push('NULL chainId');
      if (withdrawal.txHash && withdrawal.txHash.length > 100) issues.push('TX hash too long');
      if (withdrawal.timestamp && isNaN(new Date(withdrawal.timestamp))) issues.push('Invalid timestamp');
      if (withdrawal.amount && (isNaN(withdrawal.amount) || withdrawal.amount < 0)) issues.push('Invalid amount');
      
      if (issues.length > 0) {
        withdrawalIssues.push({
          index: index + 1,
          id: withdrawal._id,
          issues: issues
        });
      }
    });

    // Calculate totals
    const totalDeposited = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const netBalance = totalDeposited - totalWithdrawn;

    // Return detailed analysis
    res.json({
      success: true,
      userAddress: normalizedAddress,
      summary: {
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        totalDeposited: totalDeposited,
        totalWithdrawn: totalWithdrawn,
        netBalance: netBalance
      },
      deposits: deposits.map(d => ({
        id: d._id,
        amount: d.amount,
        currentBalance: d.currentBalance,
        accumulatedYield: d.accumulatedYield,
        chainId: d.chainId,
        txHash: d.txHash,
        timestamp: d.timestamp,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      })),
      withdrawals: withdrawals.map(w => ({
        id: w._id,
        amount: w.amount,
        chainId: w.chainId,
        txHash: w.txHash,
        timestamp: w.timestamp,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      })),
      issues: {
        deposits: depositIssues,
        withdrawals: withdrawalIssues
      }
    });

  } catch (error) {
    console.error('Data integrity check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize reserve ledger if it doesn't exist
async function initializeReserveLedger() {
  try {
    const chains = [1, 8453]; // Ethereum and Base
    const initialReserve = 100000; // 100k USDT per chain
    
    for (const chainId of chains) {
      const existingReserve = await ReserveLedger.findOne({ chainId }).lean();
      
      if (!existingReserve) {
        const newReserve = new ReserveLedger({
          totalReserve: initialReserve,
          chainId: chainId,
          lastUpdated: new Date(),
          notes: `Initial reserve for chain ${chainId}`
        });
        
        await newReserve.save();
        console.log(`✅ Initialized reserve ledger for chain ${chainId}: ${initialReserve} USDT`);
      } else {
        console.log(`ℹ️  Reserve ledger for chain ${chainId} already exists: ${existingReserve.totalReserve} USDT`);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing reserve ledger:', error);
  }
}

// Initialize reserve ledgers for both development and production
const initializeServer = async () => {
  console.log(`🚀 Initializing server in ${process.env.NODE_ENV || 'development'} mode...`);
  try {
    // Connect to MongoDB with enhanced error handling
    console.log('🔌 Connecting to MongoDB...');
    await connectToMongoDB().catch((err) => {
      console.error("❌ DB connect failed:", err);
      throw new Error(`Database connection failed: ${err.message}`);
    });
    
    console.log('📊 Initializing reserve ledger...');
    await initializeReserveLedger();
    
    // Validate chain configuration
    console.log('🔗 Validating chain configuration...');
    const chainConfig = validateChainConfiguration();
    
    for (const [chainId, config] of Object.entries(chainConfig)) {
      if (config.isValid) {
        console.log(`✅ Chain ${chainId} (${config.name}): Configured`);
        
        // Check treasury balance
        try {
          const balance = await getTreasuryBalance(parseInt(chainId));
          console.log(`💰 Treasury balance on ${config.name}: ${balance} USDT`);
        } catch (error) {
          console.log(`⚠️  Could not check treasury balance on ${config.name}: ${error.message}`);
        }
      } else {
        console.log(`❌ Chain ${chainId} (${config.name}): Missing configuration`);
        console.log(`   RPC URL: ${config.rpcUrl ? '✅' : '❌'}`);
        console.log(`   Private Key: ${config.privateKey ? '✅' : '❌'}`);
        console.log(`   USDT Address: ${config.usdtAddress ? '✅' : '❌'}`);
      }
    }
    
    if (process.env.DRY_RUN === 'true') {
      console.log('🔍 DRY RUN MODE: On-chain transfers will be simulated');
    }
    
    console.log('✅ Server initialization completed');
    
  } catch (err) {
    console.error('❌ Server initialization failed:', err);
    // Don't exit process in production, let Vercel handle it
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    console.error('❌ Server initialization failed in production:', err);
    // In production, just log the error and continue
  }
};

// Global error handler to ensure JSON responses
app.use((error, req, res, next) => {
  console.error('Global error handler caught:', error);
  
  // Always return JSON, never HTML
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    details: error.message,
    code: 'GLOBAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'The requested endpoint does not exist',
    code: 'NOT_FOUND'
  });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeServer();
  });
} else {
  // Production mode - initialize immediately
  initializeServer();
}

export default app;