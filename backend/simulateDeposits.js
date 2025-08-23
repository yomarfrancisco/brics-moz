#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Deposit Schema (copied from server.js)
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
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const Deposit = mongoose.model('Deposit', depositSchema);

// Generate random Ethereum-like address
function generateRandomAddress() {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

// Generate random transaction hash
function generateRandomTxHash() {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Safe float handling
function safeFloat(value) {
  return parseFloat(Number(value).toFixed(6));
}

async function connectToMongoDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined. Please set it in environment variables.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  console.log('📊 URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

  try {
    const connection = await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'deposit-simulator',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('🗄️  Database:', connection.connection.db.databaseName);
    
    return connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', {
      message: err.message,
      code: err.code,
      name: err.name,
    });
    process.exit(1);
  }
}

async function createInitialDeposits() {
  console.log('\n💰 Creating initial test deposits...');
  
  const deposits = [
    {
      userAddress: generateRandomAddress(),
      amount: 10,
      chainId: 8453, // Base
      txHash: generateRandomTxHash(),
    },
    {
      userAddress: generateRandomAddress(),
      amount: 20,
      chainId: 8453, // Base
      txHash: generateRandomTxHash(),
    },
    {
      userAddress: generateRandomAddress(),
      amount: 50,
      chainId: 1, // Ethereum
      txHash: generateRandomTxHash(),
    }
  ];

  const createdDeposits = [];
  
  for (const depositData of deposits) {
    try {
      const deposit = new Deposit({
        date: new Date(),
        userAddress: depositData.userAddress,
        amount: safeFloat(depositData.amount),
        currentBalance: safeFloat(depositData.amount), // Initially same as amount
        tokenType: 'USDT',
        txHash: depositData.txHash,
        chainId: depositData.chainId,
        accumulatedYield: 0,
        dailyYield: 0,
        dailyYieldPercent: 0.5,
        yieldGoalMet: false,
        timestamp: new Date(),
        isTestData: true, // Tag as test data
      });

      await deposit.save();
      createdDeposits.push(deposit);
      
      console.log(`✅ Created deposit: ${depositData.userAddress} - ${depositData.amount} USDT on chain ${depositData.chainId}`);
    } catch (error) {
      console.error(`❌ Failed to create deposit for ${depositData.userAddress}:`, error.message);
    }
  }
  
  console.log(`📊 Created ${createdDeposits.length} test deposits`);
  return createdDeposits;
}

async function updateYields() {
  try {
    // Fetch all test deposits
    const testDeposits = await Deposit.find({ isTestData: true }).lean();
    
    if (testDeposits.length === 0) {
      console.log('ℹ️  No test deposits found to update');
      return;
    }
    
    console.log(`\n📈 Updating yields for ${testDeposits.length} test deposits...`);
    
    for (const deposit of testDeposits) {
      const now = new Date();
      const createdAt = new Date(deposit.createdAt);
      
      // Calculate days elapsed
      const daysElapsed = (now - createdAt) / (1000 * 60 * 60 * 24);
      
      // Calculate new values
      const amount = safeFloat(deposit.amount);
      const dailyYieldPercent = safeFloat(deposit.dailyYieldPercent);
      
      const accumulatedYield = safeFloat(amount * (dailyYieldPercent / 100) * daysElapsed);
      const currentBalance = safeFloat(amount + accumulatedYield);
      const dailyYield = safeFloat(amount * (dailyYieldPercent / 100));
      
      // Update the document
      await Deposit.findByIdAndUpdate(
        deposit._id,
        {
          accumulatedYield,
          currentBalance,
          dailyYield,
          updatedAt: now
        }
      );
      
      console.log(`💰 ${deposit.userAddress.slice(0, 8)}...${deposit.userAddress.slice(-6)}:`);
      console.log(`   Amount: ${amount} USDT`);
      console.log(`   Days Elapsed: ${daysElapsed.toFixed(2)}`);
      console.log(`   Accumulated Yield: ${accumulatedYield.toFixed(6)} USDT`);
      console.log(`   Current Balance: ${currentBalance.toFixed(6)} USDT`);
      console.log(`   Daily Yield: ${dailyYield.toFixed(6)} USDT`);
      console.log(`   Chain: ${deposit.chainId}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating yields:', error);
  }
}

async function cleanupTestData() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    const result = await Deposit.deleteMany({ isTestData: true });
    console.log(`✅ Removed ${result.deletedCount} test deposits`);
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
  }
}

async function main() {
  console.log('🚀 Starting Deposit Simulation');
  console.log('==============================');
  
  let connection;
  
  try {
    // Connect to MongoDB
    connection = await connectToMongoDB();
    
    // Check if test deposits already exist
    const existingTestDeposits = await Deposit.find({ isTestData: true }).lean();
    
    if (existingTestDeposits.length > 0) {
      console.log(`\n⚠️  Found ${existingTestDeposits.length} existing test deposits.`);
      console.log('   Use cleanup mode or remove manually before creating new ones.');
      
      // Update existing test deposits
      await updateYields();
    } else {
      // Create new test deposits
      await createInitialDeposits();
    }
    
    // Start the yield simulation loop
    console.log('\n⏰ Starting yield simulation loop (every 10 seconds)...');
    console.log('   Press Ctrl+C to stop');
    
    // Initial update
    await updateYields();
    
    // Set up interval for updates
    const intervalId = setInterval(async () => {
      await updateYields();
    }, 10000); // 10 seconds
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping simulation...');
      clearInterval(intervalId);
      
      // Ask if user wants to cleanup
      console.log('\n🧹 Do you want to remove test deposits? (y/n)');
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        if (answer === 'y' || answer === 'yes') {
          await cleanupTestData();
        }
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    if (connection) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

// Run the script
main();
