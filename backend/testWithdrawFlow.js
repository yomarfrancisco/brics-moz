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
      appName: 'withdraw-flow-tester',
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

async function createTestDeposit(userAddress, amount, chainId) {
  console.log(`\n📥 Creating test deposit: ${amount} USDT for ${userAddress} on chain ${chainId}`);
  
  try {
    const response = await fetch('http://localhost:4000/api/deposits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress.toLowerCase(),
        amount: amount,
        txHash: `0xtest${Date.now()}`,
        chainId: chainId
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Test deposit created successfully');
      return result;
    } else {
      throw new Error(result.error || 'Failed to create test deposit');
    }
  } catch (error) {
    console.error('❌ Error creating test deposit:', error.message);
    throw error;
  }
}

async function fetchUserBalance(userAddress) {
  console.log(`\n💰 Fetching balance for ${userAddress}`);
  
  try {
    const response = await fetch(`http://localhost:4000/api/deposits/${userAddress.toLowerCase()}`);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Balance fetched successfully');
      console.log(`   Total Deposited: ${result.totalDeposited} USDT`);
      console.log(`   Deposits Count: ${result.deposits.length}`);
      
      if (result.deposits.length > 0) {
        const latestDeposit = result.deposits[0];
        console.log(`   Latest Deposit:`);
        console.log(`     Amount: ${latestDeposit.amount} USDT`);
        console.log(`     Current Balance: ${latestDeposit.currentBalance} USDT`);
        console.log(`     Accumulated Yield: ${latestDeposit.accumulatedYield} USDT`);
        console.log(`     Daily Yield %: ${latestDeposit.dailyYieldPercent}%`);
      }
      
      return result;
    } else {
      throw new Error(result.error || 'Failed to fetch balance');
    }
  } catch (error) {
    console.error('❌ Error fetching balance:', error.message);
    throw error;
  }
}

async function testWithdrawal(userAddress, amount, chainId) {
  console.log(`\n🔄 Testing withdrawal: ${amount} USDT for ${userAddress} on chain ${chainId}`);
  
  try {
    const response = await fetch('http://localhost:4000/api/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress.toLowerCase(),
        chainId: chainId,
        redeemAmount: amount,
        tokenType: "USDT",
        testMode: true
      })
    });
    
    const result = await response.json();
    
    console.log('📥 Withdrawal Response:');
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   TX Hash: ${result.txHash}`);
      console.log(`   New Balance: ${result.newBalance} USDT`);
      console.log(`   Redeemed Amount: ${result.redeemedAmount} USDT`);
      console.log(`   Reserve Before: ${result.reserveBefore} USDT`);
      console.log(`   Reserve After: ${result.reserveAfter} USDT`);
      console.log(`   On-Chain Success: ${result.onChainSuccess}`);
      console.log(`   Dry Run: ${result.dryRun}`);
      
      if (result.blockNumber) {
        console.log(`   Block Number: ${result.blockNumber}`);
      }
      if (result.gasUsed) {
        console.log(`   Gas Used: ${result.gasUsed}`);
      }
    } else {
      console.log(`   Error: ${result.error}`);
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error testing withdrawal:', error.message);
    throw error;
  }
}

async function checkReserveStatus() {
  console.log(`\n🏦 Checking reserve status`);
  
  try {
    const response = await fetch('http://localhost:4000/api/reserve-status');
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Reserve status fetched');
      console.log(`   Total Reserve: ${result.totalReserve} USDT`);
      console.log(`   Chain Reserves:`, result.chainReserves);
    } else {
      console.log('⚠️  Could not fetch reserve status (endpoint may not exist)');
    }
  } catch (error) {
    console.log('⚠️  Could not fetch reserve status (endpoint may not exist)');
  }
}

async function main() {
  console.log('🧪 Testing Complete Withdrawal Flow');
  console.log('==================================');
  
  let connection;
  
  try {
    // Connect to MongoDB
    connection = await connectToMongoDB();
    
    // Generate test user address
    const testUserAddress = generateRandomAddress();
    console.log(`\n👤 Test user address: ${testUserAddress}`);
    
    // Wait for server to be ready
    console.log('\n⏳ Waiting 3 seconds for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 1: Create a test deposit
    console.log('\n📋 Step 1: Creating Test Deposit');
    console.log('================================');
    await createTestDeposit(testUserAddress, 30, 8453); // 30 USDT on Base
    
    // Step 2: Fetch initial balance
    console.log('\n📋 Step 2: Fetching Initial Balance');
    console.log('===================================');
    const initialBalance = await fetchUserBalance(testUserAddress);
    
    // Step 3: Check reserve status before withdrawal
    console.log('\n📋 Step 3: Checking Reserve Status (Before)');
    console.log('===========================================');
    await checkReserveStatus();
    
    // Step 4: Test withdrawal
    console.log('\n📋 Step 4: Testing Withdrawal');
    console.log('=============================');
    const withdrawalResult = await testWithdrawal(testUserAddress, 10, 8453); // Withdraw 10 USDT
    
    // Step 5: Fetch balance after withdrawal
    console.log('\n📋 Step 5: Fetching Balance After Withdrawal');
    console.log('============================================');
    const finalBalance = await fetchUserBalance(testUserAddress);
    
    // Step 6: Check reserve status after withdrawal
    console.log('\n📋 Step 6: Checking Reserve Status (After)');
    console.log('==========================================');
    await checkReserveStatus();
    
    // Step 7: Summary
    console.log('\n📋 Step 7: Test Summary');
    console.log('=======================');
    console.log(`   User Address: ${testUserAddress}`);
    console.log(`   Initial Balance: ${initialBalance.totalDeposited} USDT`);
    console.log(`   Withdrawal Amount: 10 USDT`);
    console.log(`   Final Balance: ${finalBalance.totalDeposited} USDT`);
    console.log(`   Balance Difference: ${initialBalance.totalDeposited - finalBalance.totalDeposited} USDT`);
    console.log(`   Withdrawal Success: ${withdrawalResult.success}`);
    
    if (withdrawalResult.success) {
      console.log(`   Transaction Hash: ${withdrawalResult.txHash}`);
      console.log(`   On-Chain Success: ${withdrawalResult.onChainSuccess}`);
    }
    
    console.log('\n🎉 Withdrawal flow test completed!');
    
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
