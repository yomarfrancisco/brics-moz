import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import { syncDepositsToSheet, syncWithdrawalsToSheet, updateYieldFromSheet, updateWithdrawalStatusFromSheet } from './sheets.js';
import cron from 'node-cron';
import { google } from 'googleapis'; // Added

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

console.log('Environment Variables:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  GOOGLE_SHEETS_CREDENTIALS_PATH: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ? 'Set' : 'Not set',
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID ? 'Set' : 'Not set',
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined. Please set it in environment variables.');
  process.exit(1);
}

console.log('Connecting to MongoDB with URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

let mongooseConnection = null;
async function connectToMongoDB() {
  if (mongooseConnection) {
    console.log('Reusing existing MongoDB connection');
    return mongooseConnection;
  }
  try {
    mongooseConnection = await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'ethers-cluster',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    console.log('MongoDB connected successfully');
    console.log('Database Name:', mongooseConnection.connection.db.databaseName);
    console.log('Collections:', await mongooseConnection.connection.db.listCollections().toArray());
    return mongooseConnection;
  } catch (err) {
    console.error('MongoDB connection error:', {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    });
    process.exit(1);
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
    console.log('Fetching deposits for:', userAddress);
    const deposits = await Deposit.find({ userAddress }).lean().maxTimeMS(15000);
    console.log('Deposits found:', deposits);

    const withdrawals = await Withdrawal.find({ userAddress }).lean().maxTimeMS(15000);
    console.log('Withdrawals found:', withdrawals);

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

    res.json({
      success: true,
      deposits,
      withdrawals,
      totalUsdtDeposited: netUsdtDeposited,
      totalMockUsdtDeposited: netMockUsdtDeposited,
    });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deposits', details: error.message });
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

    // Fetch existing deposits for this user on this chain
    const existingDeposits = await Deposit.find({ userAddress: normalizedUserAddress, chainId: parsedChainId }).lean().maxTimeMS(15000);
    const totalDepositedSoFar = existingDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const newTotalBalance = totalDepositedSoFar + parsedAmount;

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
        await Deposit.updateMany(
          { userAddress: normalizedUserAddress, chainId: parsedChainId, txHash: { $ne: normalizedTxHash } },
          { $set: { currentBalance: newTotalBalance } }
        );
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

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    try {
      await connectToMongoDB();
    } catch (err) {
      console.error('Startup MongoDB connection failed:', err);
      process.exit(1);
    }
  });
}

export default app;