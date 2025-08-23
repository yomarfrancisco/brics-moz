#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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
  // Redemption tracking fields
  lastRedeemedAt: { type: Date, default: null },
  lastRedeemedAmount: { type: Number, default: null },
  lastRedeemedTxHash: { type: String, default: null },
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
      appName: 'redeem-tester',
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

async function createTestDeposit() {
  console.log('\n💰 Creating test deposit for redemption testing...');
  
  const testUserAddress = generateRandomAddress();
  const testTxHash = generateRandomTxHash();
  const testAmount = 100; // 100 USDT
  
  try {
    const deposit = new Deposit({
      date: new Date(),
      userAddress: testUserAddress,
      amount: testAmount,
      currentBalance: testAmount, // Initially same as amount
      tokenType: 'USDT',
      txHash: testTxHash,
      chainId: 8453, // Base chain
      accumulatedYield: 0,
      dailyYield: 0,
      dailyYieldPercent: 0.5,
      yieldGoalMet: false,
      timestamp: new Date(),
      isTestData: false, // Not test data so it can be redeemed
    });

    await deposit.save();
    
    console.log(`✅ Created test deposit:`);
    console.log(`   User Address: ${testUserAddress}`);
    console.log(`   Amount: ${testAmount} USDT`);
    console.log(`   Chain: Base (8453)`);
    console.log(`   TX Hash: ${testTxHash}`);
    console.log(`   Current Balance: ${testAmount} USDT`);
    
    return { deposit, testUserAddress };
  } catch (error) {
    console.error('❌ Failed to create test deposit:', error.message);
    throw error;
  }
}

async function testRedeemEndpoint(userAddress, redeemAmount = 25) {
  console.log(`\n🔄 Testing redeem endpoint with ${redeemAmount} USDT...`);
  
  const redeemData = {
    userAddress: userAddress,
    chainId: 8453,
    redeemAmount: redeemAmount,
    tokenType: "USDT"
  };
  
  console.log('📤 Sending redemption request:', redeemData);
  
  try {
    const response = await fetch('http://localhost:4000/api/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(redeemData)
    });
    
    const result = await response.json();
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response body:', JSON.stringify(result, null, 2));
    
    return { success: response.ok, result };
  } catch (error) {
    console.error('❌ Error calling redeem endpoint:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkDepositState(userAddress) {
  console.log('\n📊 Checking deposit state after redemption...');
  
  try {
    const deposits = await Deposit.find({ userAddress: userAddress.toLowerCase() }).lean();
    
    console.log(`Found ${deposits.length} deposits for user ${userAddress}:`);
    
    deposits.forEach((deposit, index) => {
      console.log(`\n${index + 1}. Deposit ID: ${deposit._id}`);
      console.log(`   Original Amount: ${deposit.amount} USDT`);
      console.log(`   Current Balance: ${deposit.currentBalance} USDT`);
      console.log(`   Accumulated Yield: ${deposit.accumulatedYield} USDT`);
      console.log(`   Last Redeemed At: ${deposit.lastRedeemedAt || 'Never'}`);
      console.log(`   Last Redeemed Amount: ${deposit.lastRedeemedAmount || 'None'}`);
      console.log(`   Last Redeemed TX Hash: ${deposit.lastRedeemedTxHash || 'None'}`);
      console.log(`   Chain: ${deposit.chainId}`);
      console.log(`   TX Hash: ${deposit.txHash}`);
    });
    
    return deposits;
  } catch (error) {
    console.error('❌ Error checking deposit state:', error.message);
    throw error;
  }
}

async function cleanupTestData(userAddress) {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    const result = await Deposit.deleteMany({ userAddress: userAddress.toLowerCase() });
    console.log(`✅ Removed ${result.deletedCount} test deposits`);
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error.message);
  }
}

async function main() {
  console.log('🧪 Starting Redeem Endpoint Test');
  console.log('================================');
  
  let connection;
  let testUserAddress;
  
  try {
    // Connect to MongoDB
    connection = await connectToMongoDB();
    
    // Create test deposit
    const { deposit, testUserAddress: userAddr } = await createTestDeposit();
    testUserAddress = userAddr;
    
    // Wait a moment for the server to be ready
    console.log('\n⏳ Waiting 2 seconds for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test redemption scenarios
    console.log('\n🎯 Testing Redemption Scenarios:');
    console.log('================================');
    
    // Test 1: Partial redemption
    console.log('\n📋 Test 1: Partial Redemption (25 USDT)');
    const test1Result = await testRedeemEndpoint(testUserAddress, 25);
    
    if (test1Result.success) {
      console.log('✅ Partial redemption successful');
    } else {
      console.log('❌ Partial redemption failed');
    }
    
    // Check state after first redemption
    await checkDepositState(testUserAddress);
    
    // Test 2: Another partial redemption
    console.log('\n📋 Test 2: Another Partial Redemption (30 USDT)');
    const test2Result = await testRedeemEndpoint(testUserAddress, 30);
    
    if (test2Result.success) {
      console.log('✅ Second partial redemption successful');
    } else {
      console.log('❌ Second partial redemption failed');
    }
    
    // Check state after second redemption
    await checkDepositState(testUserAddress);
    
    // Test 3: Try to redeem more than available (should fail)
    console.log('\n📋 Test 3: Over-Redemption (100 USDT - should fail)');
    const test3Result = await testRedeemEndpoint(testUserAddress, 100);
    
    if (!test3Result.success) {
      console.log('✅ Over-redemption correctly rejected');
    } else {
      console.log('❌ Over-redemption should have failed');
    }
    
    // Test 4: Full redemption of remaining balance
    console.log('\n📋 Test 4: Full Redemption of Remaining Balance');
    const test4Result = await testRedeemEndpoint(testUserAddress, 45);
    
    if (test4Result.success) {
      console.log('✅ Full redemption successful');
    } else {
      console.log('❌ Full redemption failed');
    }
    
    // Final state check
    await checkDepositState(testUserAddress);
    
    // Ask if user wants to cleanup
    console.log('\n🧹 Do you want to remove test deposits? (y/n)');
    process.stdin.once('data', async (data) => {
      const answer = data.toString().trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        await cleanupTestData(testUserAddress);
      }
      
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (connection) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

// Run the test
main();
