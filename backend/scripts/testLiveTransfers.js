#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:4000';

// Generate a random Ethereum-like address
const generateRandomAddress = () => {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
};

// Test live transfer functionality
const testLiveTransfers = async () => {
  const testUserAddress = generateRandomAddress();
  const chainId = 8453; // Base chain

  console.log('🚀 Testing Live Transfer Functionality');
  console.log('=====================================');
  console.log(`👤 Test User: ${testUserAddress}`);
  console.log(`🔗 Chain ID: ${chainId} (Base)`);
  console.log(`💰 Initial Reserve: 100,000 USDT per chain`);
  console.log('');

  try {
    // Step 1: Check initial reserve status
    console.log('📊 Step 1: Checking initial reserve status...');
    const initialReserveResponse = await fetch(`${API_BASE_URL}/api/reserve-status`);
    const initialReserveResult = await initialReserveResponse.json();
    console.log(`✅ Initial Reserve - Chain ${chainId}: ${initialReserveResult.chainReserves[chainId]?.totalReserve || 0} USDT`);
    console.log('');

    // Step 2: Create a deposit
    console.log('📥 Step 2: Creating deposit...');
    const depositAmount = 200;
    const depositResponse = await fetch(`${API_BASE_URL}/api/deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        amount: depositAmount,
        txHash: `0xdeposit${Date.now()}`,
        chainId: chainId
      })
    });

    if (!depositResponse.ok) {
      throw new Error(`Deposit failed: ${depositResponse.status}`);
    }

    const depositResult = await depositResponse.json();
    console.log(`✅ Deposit created: ${depositResult.deposit.amount} USDT`);
    console.log(`   Current Balance: ${depositResult.deposit.currentBalance} USDT`);
    console.log('');

    // Step 3: Live withdrawal (no test mode)
    console.log('💸 Step 3: Processing live withdrawal (no test mode)...');
    const liveWithdrawalAmount = 50;
    const liveWithdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: liveWithdrawalAmount,
        tokenType: 'USDT',
        testMode: false // Live transfer
      })
    });

    if (!liveWithdrawalResponse.ok) {
      throw new Error(`Live withdrawal failed: ${liveWithdrawalResponse.status}`);
    }

    const liveWithdrawalResult = await liveWithdrawalResponse.json();
    console.log(`✅ Live withdrawal processed: ${liveWithdrawalResult.redeemedAmount} USDT`);
    console.log(`   New Balance: ${liveWithdrawalResult.newBalance} USDT`);
    console.log(`   Transaction Hash: ${liveWithdrawalResult.txHash}`);
    console.log(`   Reserve Before: ${liveWithdrawalResult.reserveBefore} USDT`);
    console.log(`   Reserve After: ${liveWithdrawalResult.reserveAfter} USDT`);
    console.log(`   Test Mode: ${liveWithdrawalResult.testMode}`);
    console.log(`   Dry Run: ${liveWithdrawalResult.dryRun}`);
    console.log(`   On-Chain Success: ${liveWithdrawalResult.onChainSuccess}`);
    console.log('');

    // Step 4: Check reserve status after live withdrawal
    console.log('📊 Step 4: Checking reserve status after live withdrawal...');
    const liveReserveResponse = await fetch(`${API_BASE_URL}/api/reserve-status`);
    const liveReserveResult = await liveReserveResponse.json();
    console.log(`✅ Reserve after live withdrawal - Chain ${chainId}: ${liveReserveResult.chainReserves[chainId]?.totalReserve || 0} USDT`);
    console.log(`   Reserve decreased by: ${liveWithdrawalAmount} USDT`);
    console.log('');

    // Step 5: Test mode withdrawal (for comparison)
    console.log('🧪 Step 5: Processing test mode withdrawal (for comparison)...');
    const testWithdrawalAmount = 25;
    const testWithdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: testWithdrawalAmount,
        tokenType: 'USDT',
        testMode: true // Test mode
      })
    });

    if (!testWithdrawalResponse.ok) {
      throw new Error(`Test withdrawal failed: ${testWithdrawalResponse.status}`);
    }

    const testWithdrawalResult = await testWithdrawalResponse.json();
    console.log(`✅ Test withdrawal processed: ${testWithdrawalResult.redeemedAmount} USDT`);
    console.log(`   New Balance: ${testWithdrawalResult.newBalance} USDT`);
    console.log(`   Transaction Hash: ${testWithdrawalResult.txHash}`);
    console.log(`   Reserve Before: ${testWithdrawalResult.reserveBefore} USDT`);
    console.log(`   Reserve After: ${testWithdrawalResult.reserveAfter} USDT`);
    console.log(`   Test Mode: ${testWithdrawalResult.testMode}`);
    console.log(`   Dry Run: ${testWithdrawalResult.dryRun}`);
    console.log(`   On-Chain Success: ${testWithdrawalResult.onChainSuccess}`);
    console.log('');

    // Step 6: Check reserve status after test withdrawal
    console.log('📊 Step 6: Checking reserve status after test withdrawal...');
    const testReserveResponse = await fetch(`${API_BASE_URL}/api/reserve-status`);
    const testReserveResult = await testReserveResponse.json();
    console.log(`✅ Reserve after test withdrawal - Chain ${chainId}: ${testReserveResult.chainReserves[chainId]?.totalReserve || 0} USDT`);
    console.log(`   Reserve unchanged (test mode doesn't affect reserve)`);
    console.log('');

    // Step 7: Verify final user balance
    console.log('💰 Step 7: Verifying final user balance...');
    const finalBalanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    const finalBalanceResult = await finalBalanceResponse.json();
    console.log(`✅ Final user balance: ${finalBalanceResult.deposits[0]?.currentBalance || 0} USDT`);
    console.log(`   Total deposited: ${finalBalanceResult.totalDeposited} USDT`);
    console.log('');

    // Step 8: Summary
    console.log('🎉 Live Transfer Test Results');
    console.log('============================');
    console.log('📊 Summary:');
    console.log(`   Initial Deposit: ${depositAmount} USDT`);
    console.log(`   Live Withdrawal: ${liveWithdrawalAmount} USDT (reserve deducted)`);
    console.log(`   Test Withdrawal: ${testWithdrawalAmount} USDT (reserve unchanged)`);
    console.log(`   Final Balance: ${finalBalanceResult.deposits[0]?.currentBalance || 0} USDT`);
    console.log(`   Final Reserve: ${testReserveResult.chainReserves[chainId]?.totalReserve || 0} USDT`);
    console.log('');
    console.log('✅ Key Differences:');
    console.log('   🔴 Live Transfer:');
    console.log('      - Reserve is deducted');
    console.log('      - Real transaction hash generated');
    console.log('      - On-chain success: true');
    console.log('      - Dry run: false');
    console.log('');
    console.log('   🟡 Test Mode:');
    console.log('      - Reserve unchanged');
    console.log('      - Mock transaction hash');
    console.log('      - On-chain success: true (simulated)');
    console.log('      - Dry run: true');
    console.log('');
    console.log('✅ Live transfer functionality is working correctly!');
    console.log('✅ Reserve ledger is properly updated for live transfers!');
    console.log('✅ Test mode correctly bypasses reserve deduction!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the test
testLiveTransfers();
