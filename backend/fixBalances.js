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
      appName: 'balance-fixer',
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

async function fixBalances() {
  try {
    console.log('\n🔧 Starting balance fix process...');
    
    // Fetch all deposits
    console.log('📥 Fetching all deposits from database...');
    const deposits = await Deposit.find({}).lean();
    console.log(`📊 Found ${deposits.length} deposits to check`);
    
    if (deposits.length === 0) {
      console.log('ℹ️  No deposits found. Nothing to fix.');
      return;
    }
    
    let fixedCount = 0;
    let unchangedCount = 0;
    const updatedDeposits = [];
    
    // Process each deposit
    for (const deposit of deposits) {
      const { _id, amount, accumulatedYield, currentBalance, userAddress, txHash, chainId } = deposit;
      
      // Parse values as numbers
      const parsedAmount = Number(amount) || 0;
      const parsedAccumulatedYield = Number(accumulatedYield) || 0;
      const parsedCurrentBalance = Number(currentBalance) || 0;
      
      // Calculate correct balance
      const correctBalance = parsedAmount + parsedAccumulatedYield;
      
      // Check if balance needs fixing
      if (Math.abs(parsedCurrentBalance - correctBalance) > 0.001) { // Using small epsilon for float comparison
        console.log(`🔧 Fixing deposit ${_id}:`);
        console.log(`   User: ${userAddress}`);
        console.log(`   Chain: ${chainId}`);
        console.log(`   Amount: ${parsedAmount}`);
        console.log(`   Accumulated Yield: ${parsedAccumulatedYield}`);
        console.log(`   Old Balance: ${parsedCurrentBalance}`);
        console.log(`   New Balance: ${correctBalance}`);
        console.log(`   Difference: ${correctBalance - parsedCurrentBalance}`);
        
        // Update the document
        const updatedDeposit = await Deposit.findByIdAndUpdate(
          _id,
          { 
            currentBalance: correctBalance,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        updatedDeposits.push({
          id: _id,
          userAddress,
          chainId,
          oldBalance: parsedCurrentBalance,
          newBalance: correctBalance,
          difference: correctBalance - parsedCurrentBalance,
          txHash
        });
        
        fixedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    // Summary
    console.log('\n📋 Balance Fix Summary:');
    console.log(`✅ Fixed: ${fixedCount} deposits`);
    console.log(`ℹ️  Unchanged: ${unchangedCount} deposits`);
    console.log(`📊 Total processed: ${deposits.length} deposits`);
    
    if (updatedDeposits.length > 0) {
      console.log('\n📝 Updated Deposits:');
      updatedDeposits.forEach((deposit, index) => {
        console.log(`\n${index + 1}. Deposit ID: ${deposit.id}`);
        console.log(`   User: ${deposit.userAddress}`);
        console.log(`   Chain: ${deposit.chainId}`);
        console.log(`   Old Balance: ${deposit.oldBalance}`);
        console.log(`   New Balance: ${deposit.newBalance}`);
        console.log(`   Difference: ${deposit.difference > 0 ? '+' : ''}${deposit.difference}`);
        console.log(`   TX Hash: ${deposit.txHash}`);
      });
    }
    
    console.log('\n🎉 Balance fix process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during balance fix process:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Balance Fixer Script');
  console.log('================================');
  
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Fix balances
    await fixBalances();
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
