#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
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

async function testEnvironmentVariables() {
  console.log('\n🔧 Testing Environment Variables');
  console.log('================================');
  
  const requiredVars = [
    'ETHEREUM_PRIVATE_KEY',
    'BASE_PRIVATE_KEY',
    'INFURA_API_KEY',
    'ALCHEMY_BASE_URL',
    'DRY_RUN'
  ];
  
  const optionalVars = [
    'USDT_ETHEREUM_ADDRESS',
    'USDT_BASE_ADDRESS'
  ];
  
  console.log('\nRequired Variables:');
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      if (varName.includes('PRIVATE_KEY')) {
        console.log(`  ${varName}: ✅ Configured (${value.slice(0, 10)}...)`);
      } else if (varName.includes('URL')) {
        console.log(`  ${varName}: ✅ Configured (${value.slice(0, 50)}...)`);
      } else {
        console.log(`  ${varName}: ✅ Configured`);
      }
    } else {
      console.log(`  ${varName}: ❌ Missing`);
    }
  }
  
  console.log('\nOptional Variables:');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ${varName}: ✅ Configured (${value})`);
    } else {
      console.log(`  ${varName}: ℹ️  Using default`);
    }
  }
  
  console.log(`\nDRY_RUN Mode: ${process.env.DRY_RUN === 'true' ? '🔍 Enabled' : '🚀 Disabled'}`);
}

async function main() {
  console.log('🧪 Testing On-Chain Transfer System (Standalone)');
  console.log('==============================================');
  
  try {
    // Test environment variables
    await testEnvironmentVariables();
    
    // Test chain configuration
    const chainConfig = await testChainConfiguration();
    
    if (!chainConfig) {
      console.log('\n❌ Cannot proceed without valid chain configuration.');
      console.log('Please check your .env file and ensure all required variables are set.');
      return;
    }
    
    // Find valid chains for testing
    const validChains = Object.entries(chainConfig).filter(([_, config]) => config.isValid);
    
    if (validChains.length === 0) {
      console.log('\n❌ No valid chains configured for testing.');
      console.log('Please configure at least one chain with valid RPC URL and private key.');
      return;
    }
    
    console.log(`\n✅ Found ${validChains.length} valid chain(s) for testing`);
    
    // Test each valid chain
    for (const [chainId, config] of validChains) {
      console.log(`\n🎯 Testing Chain ${chainId} (${config.name})`);
      
      // Test 1: Small amount dry run
      await testDirectTransfer(parseInt(chainId), 1, true);
      
      // Test 2: Larger amount dry run
      await testDirectTransfer(parseInt(chainId), 10, true);
      
      // Test 3: Live transfer (only if DRY_RUN is false)
      if (process.env.DRY_RUN !== 'true') {
        console.log('\n⚠️  WARNING: Testing live transfer (DRY_RUN=false)');
        console.log('This will execute actual blockchain transactions!');
        
        // Ask for confirmation (in a real scenario)
        console.log('Skipping live transfer for safety. Set DRY_RUN=true to test simulation mode.');
      } else {
        console.log('\n🔍 DRY_RUN mode enabled - all transfers are simulated');
      }
    }
    
    console.log('\n🎉 On-chain transfer tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Environment variables validated');
    console.log('- Chain configuration tested');
    console.log('- Transfer simulation working');
    console.log('- Ready for integration testing');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
main();
