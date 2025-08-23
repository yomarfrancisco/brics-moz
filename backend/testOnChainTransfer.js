#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { validateChainConfiguration, getTreasuryBalance, executeTransfer } from './usdt-contract.js';

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
      appName: 'onchain-tester',
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

async function testChainConfiguration() {
  console.log('\n🔗 Testing Chain Configuration');
  console.log('=============================');
  
  try {
    const chainConfig = validateChainConfiguration();
    
    for (const [chainId, config] of Object.entries(chainConfig)) {
      console.log(`\nChain ${chainId} (${config.name}):`);
      console.log(`  RPC URL: ${config.rpcUrl ? '✅ Configured' : '❌ Missing'}`);
      console.log(`  Private Key: ${config.privateKey ? '✅ Configured' : '❌ Missing'}`);
      console.log(`  USDT Address: ${config.usdtAddress ? '✅ Configured' : '❌ Missing'}`);
      console.log(`  Overall: ${config.isValid ? '✅ Valid' : '❌ Invalid'}`);
      
      if (config.isValid) {
        try {
          const balance = await getTreasuryBalance(parseInt(chainId));
          console.log(`  Treasury Balance: ${balance} USDT`);
        } catch (error) {
          console.log(`  Treasury Balance: ❌ Error - ${error.message}`);
        }
      }
    }
    
    return chainConfig;
  } catch (error) {
    console.error('❌ Error testing chain configuration:', error.message);
    return null;
  }
}

async function testDirectTransfer(chainId, amount, dryRun = true) {
  console.log(`\n🔄 Testing Direct Transfer (${dryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('==========================================');
  
  const testAddress = generateRandomAddress();
  console.log(`Test Address: ${testAddress}`);
  console.log(`Amount: ${amount} USDT`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Dry Run: ${dryRun}`);
  
  try {
    const result = await executeTransfer(testAddress, amount, chainId, dryRun);
    
    console.log('\n✅ Transfer Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(`  Block Number: ${result.blockNumber || 'N/A'}`);
    console.log(`  Gas Used: ${result.gasUsed || 'N/A'}`);
    console.log(`  Dry Run: ${result.dryRun}`);
    
    return result;
  } catch (error) {
    console.error('\n❌ Transfer Failed:');
    console.error(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testRedeemEndpoint(userAddress, amount, chainId, testMode = true) {
  console.log(`\n🔄 Testing Redeem Endpoint (${testMode ? 'TEST MODE' : 'LIVE'})`);
  console.log('==========================================');
  
  const redeemData = {
    userAddress: userAddress,
    chainId: chainId,
    redeemAmount: amount,
    tokenType: "USDT",
    testMode: testMode
  };
  
  console.log('Request Data:', redeemData);
  
  try {
    const response = await fetch('http://localhost:4000/api/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(redeemData)
    });
    
    const result = await response.json();
    
    console.log('\nResponse:');
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${result.success}`);
    
    if (result.success) {
      console.log(`  TX Hash: ${result.txHash}`);
      console.log(`  Block Number: ${result.blockNumber || 'N/A'}`);
      console.log(`  Gas Used: ${result.gasUsed || 'N/A'}`);
      console.log(`  On-Chain Success: ${result.onChainSuccess}`);
      console.log(`  Dry Run: ${result.dryRun}`);
      console.log(`  New Balance: ${result.newBalance}`);
      console.log(`  Reserve Before: ${result.reserveBefore}`);
      console.log(`  Reserve After: ${result.reserveAfter}`);
    } else {
      console.log(`  Error: ${result.error}`);
      if (result.details) {
        console.log(`  Details:`, result.details);
      }
    }
    
    return { success: response.ok, result };
  } catch (error) {
    console.error('\n❌ Request Failed:');
    console.error(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function checkRedemptionLogs() {
  console.log('\n📋 Checking Recent Redemption Logs');
  console.log('==================================');
  
  try {
    // Import the RedemptionLog model
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
    
    const RedemptionLog = mongoose.model('RedemptionLog', redemptionLogSchema);
    
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
      console.log(`   TX Hash: ${log.txHash}`);
      console.log(`   Block Number: ${log.blockNumber || 'N/A'}`);
      console.log(`   Gas Used: ${log.gasUsed || 'N/A'}`);
      console.log(`   On-Chain Success: ${log.onChainSuccess}`);
      console.log(`   Dry Run: ${log.dryRun}`);
      console.log(`   Test Mode: ${log.testMode}`);
      console.log(`   Reserve Before: ${log.reserveBefore} USDT`);
      console.log(`   Reserve After: ${log.reserveAfter} USDT`);
      if (log.transferError) {
        console.log(`   Transfer Error: ${log.transferError}`);
      }
      console.log(`   Timestamp: ${new Date(log.timestamp).toLocaleString()}`);
    });
  } catch (error) {
    console.error('❌ Error checking redemption logs:', error.message);
  }
}

async function main() {
  console.log('🧪 Testing On-Chain Transfer System');
  console.log('==================================');
  
  let connection;
  
  try {
    // Connect to MongoDB
    connection = await connectToMongoDB();
    
    // Test chain configuration
    const chainConfig = await testChainConfiguration();
    
    if (!chainConfig) {
      console.log('❌ Cannot proceed without valid chain configuration.');
      return;
    }
    
    // Find a valid chain for testing
    const validChains = Object.entries(chainConfig).filter(([_, config]) => config.isValid);
    
    if (validChains.length === 0) {
      console.log('❌ No valid chains configured for testing.');
      return;
    }
    
    const [testChainId, testChainConfig] = validChains[0];
    console.log(`\n🎯 Using chain ${testChainId} (${testChainConfig.name}) for testing`);
    
    // Generate test user address
    const testUserAddress = generateRandomAddress();
    console.log(`👤 Test user address: ${testUserAddress}`);
    
    // Wait for server to be ready
    console.log('\n⏳ Waiting 3 seconds for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Direct transfer (dry run)
    console.log('\n📋 Test 1: Direct Transfer (Dry Run)');
    await testDirectTransfer(parseInt(testChainId), 5, true);
    
    // Test 2: Redeem endpoint (test mode)
    console.log('\n📋 Test 2: Redeem Endpoint (Test Mode)');
    await testRedeemEndpoint(testUserAddress, 10, parseInt(testChainId), true);
    
    // Test 3: Redeem endpoint (live mode - if not dry run)
    if (process.env.DRY_RUN !== 'true') {
      console.log('\n📋 Test 3: Redeem Endpoint (Live Mode)');
      await testRedeemEndpoint(testUserAddress, 2, parseInt(testChainId), false);
    } else {
      console.log('\n📋 Test 3: Skipped (DRY_RUN=true in environment)');
    }
    
    // Check redemption logs
    await checkRedemptionLogs();
    
    console.log('\n🎉 On-chain transfer tests completed!');
    
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
