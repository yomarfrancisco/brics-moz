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
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const ReserveLedger = mongoose.model('ReserveLedger', reserveLedgerSchema);
const RedemptionLog = mongoose.model('RedemptionLog', redemptionLogSchema);

// Generate random Ethereum-like address
function generateRandomAddress() {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
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
      appName: 'reserve-tester',
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

async function checkReserveStatus() {
  console.log('\n📊 Checking current reserve status...');
  
  try {
    const reserves = await ReserveLedger.find({}).lean().sort({ chainId: 1 });
    
    if (reserves.length === 0) {
      console.log('❌ No reserve ledgers found. Run the server to initialize reserves.');
      return null;
    }
    
    console.log('Current reserves:');
    reserves.forEach(reserve => {
      const chainName = reserve.chainId === 1 ? 'Ethereum' : 'Base';
      console.log(`   ${chainName} (Chain ${reserve.chainId}): ${reserve.totalReserve} USDT`);
    });
    
    return reserves;
  } catch (error) {
    console.error('❌ Error checking reserve status:', error.message);
    return null;
  }
}

async function testRedeemWithReserve(userAddress, redeemAmount, testMode = false) {
  console.log(`\n🔄 Testing redemption with reserve (testMode: ${testMode})...`);
  
  const redeemData = {
    userAddress: userAddress,
    chainId: 8453,
    redeemAmount: redeemAmount,
    tokenType: "USDT",
    testMode: testMode
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

async function checkRedemptionLogs() {
  console.log('\n📋 Checking redemption logs...');
  
  try {
    const logs = await RedemptionLog.find({})
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    
    if (logs.length === 0) {
      console.log('ℹ️  No redemption logs found.');
      return;
    }
    
    console.log(`Found ${logs.length} recent redemption logs:`);
    logs.forEach((log, index) => {
      console.log(`\n${index + 1}. Redemption Log:`);
      console.log(`   User: ${log.userAddress}`);
      console.log(`   Amount: ${log.redeemAmount} USDT`);
      console.log(`   Chain: ${log.chainId}`);
      console.log(`   Reserve Before: ${log.reserveBefore} USDT`);
      console.log(`   Reserve After: ${log.reserveAfter} USDT`);
      console.log(`   Test Mode: ${log.testMode ? 'Yes' : 'No'}`);
      console.log(`   TX Hash: ${log.txHash}`);
      console.log(`   Timestamp: ${new Date(log.timestamp).toLocaleString()}`);
    });
  } catch (error) {
    console.error('❌ Error checking redemption logs:', error.message);
  }
}

async function main() {
  console.log('🧪 Testing Reserve System');
  console.log('========================');
  
  let connection;
  
  try {
    // Connect to MongoDB
    connection = await connectToMongoDB();
    
    // Check initial reserve status
    const initialReserves = await checkReserveStatus();
    if (!initialReserves) {
      console.log('❌ Cannot proceed without reserve ledgers.');
      return;
    }
    
    // Generate test user address
    const testUserAddress = generateRandomAddress();
    console.log(`\n👤 Test user address: ${testUserAddress}`);
    
    // Wait for server to be ready
    console.log('\n⏳ Waiting 3 seconds for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Test mode redemption (should skip reserve deduction)
    console.log('\n📋 Test 1: Test Mode Redemption (should skip reserve)');
    const test1Result = await testRedeemWithReserve(testUserAddress, 10, true);
    
    if (test1Result.success) {
      console.log('✅ Test mode redemption successful');
    } else {
      console.log('❌ Test mode redemption failed');
    }
    
    // Check reserve status after test mode
    await checkReserveStatus();
    
    // Test 2: Real redemption (should deduct from reserve)
    console.log('\n📋 Test 2: Real Redemption (should deduct from reserve)');
    const test2Result = await testRedeemWithReserve(testUserAddress, 5, false);
    
    if (test2Result.success) {
      console.log('✅ Real redemption successful');
    } else {
      console.log('❌ Real redemption failed');
    }
    
    // Check reserve status after real redemption
    await checkReserveStatus();
    
    // Test 3: Large redemption (should fail if insufficient reserve)
    console.log('\n📋 Test 3: Large Redemption (should fail if insufficient reserve)');
    const test3Result = await testRedeemWithReserve(testUserAddress, 200000, false);
    
    if (!test3Result.success) {
      console.log('✅ Large redemption correctly rejected (insufficient reserve)');
    } else {
      console.log('❌ Large redemption should have failed');
    }
    
    // Check redemption logs
    await checkRedemptionLogs();
    
    console.log('\n🎉 Reserve system tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
    process.exit(0);
  }
}

// Run the test
main();
