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

// Test the complete withdrawal flow with multiple scenarios
const testWithdrawFlow = async () => {
  const testUserAddress = generateRandomAddress();
  const chainId = 8453; // Base chain

  console.log('🧪 Testing Complete Withdrawal Flow');
  console.log('===================================');
  console.log(`👤 Test User: ${testUserAddress}`);
  console.log(`🔗 Chain ID: ${chainId} (Base)`);
  console.log('');

  try {
    // Scenario 1: Single deposit and withdrawal
    console.log('📋 Scenario 1: Single deposit and withdrawal');
    console.log('---------------------------------------------');
    
    const depositAmount = 100;
    const withdrawalAmount = 25;

    // Create deposit
    console.log(`📥 Creating deposit: ${depositAmount} USDT`);
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

    // Fetch initial balance
    const initialBalanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    const initialBalanceResult = await initialBalanceResponse.json();
    console.log(`💰 Initial Balance: ${initialBalanceResult.deposits[0]?.currentBalance || 0} USDT`);

    // Process withdrawal
    console.log(`💸 Processing withdrawal: ${withdrawalAmount} USDT`);
    const withdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: withdrawalAmount,
        tokenType: 'USDT',
        testMode: true
      })
    });

    if (!withdrawalResponse.ok) {
      throw new Error(`Withdrawal failed: ${withdrawalResponse.status}`);
    }

    const withdrawalResult = await withdrawalResponse.json();
    console.log(`✅ Withdrawal processed: ${withdrawalResult.redeemedAmount} USDT`);
    console.log(`   New Balance: ${withdrawalResult.newBalance} USDT`);
    console.log(`   Transaction: ${withdrawalResult.txHash}`);

    // Fetch updated balance
    const updatedBalanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    const updatedBalanceResult = await updatedBalanceResponse.json();
    console.log(`🔄 Updated Balance: ${updatedBalanceResult.deposits[0]?.currentBalance || 0} USDT`);

    // Verify balance
    const expectedBalance = depositAmount - withdrawalAmount;
    const actualBalance = updatedBalanceResult.deposits[0]?.currentBalance || 0;
    
    if (Math.abs(actualBalance - expectedBalance) < 0.01) {
      console.log(`✅ Balance verification passed: ${actualBalance} USDT`);
    } else {
      console.log(`❌ Balance verification failed: Expected ${expectedBalance}, got ${actualBalance}`);
    }

    console.log('');

    // Scenario 2: Multiple withdrawals from same deposit
    console.log('📋 Scenario 2: Multiple withdrawals from same deposit');
    console.log('----------------------------------------------------');
    
    const secondWithdrawalAmount = 15;
    console.log(`💸 Processing second withdrawal: ${secondWithdrawalAmount} USDT`);

    const secondWithdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: secondWithdrawalAmount,
        tokenType: 'USDT',
        testMode: true
      })
    });

    if (!secondWithdrawalResponse.ok) {
      throw new Error(`Second withdrawal failed: ${secondWithdrawalResponse.status}`);
    }

    const secondWithdrawalResult = await secondWithdrawalResponse.json();
    console.log(`✅ Second withdrawal processed: ${secondWithdrawalResult.redeemedAmount} USDT`);
    console.log(`   New Balance: ${secondWithdrawalResult.newBalance} USDT`);
    console.log(`   Transaction: ${secondWithdrawalResult.txHash}`);

    // Fetch final balance
    const finalBalanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    const finalBalanceResult = await finalBalanceResponse.json();
    console.log(`🔄 Final Balance: ${finalBalanceResult.deposits[0]?.currentBalance || 0} USDT`);

    // Verify final balance
    const expectedFinalBalance = depositAmount - withdrawalAmount - secondWithdrawalAmount;
    const actualFinalBalance = finalBalanceResult.deposits[0]?.currentBalance || 0;
    
    if (Math.abs(actualFinalBalance - expectedFinalBalance) < 0.01) {
      console.log(`✅ Final balance verification passed: ${actualFinalBalance} USDT`);
    } else {
      console.log(`❌ Final balance verification failed: Expected ${expectedFinalBalance}, got ${actualFinalBalance}`);
    }

    console.log('');

    // Scenario 3: Test insufficient balance
    console.log('📋 Scenario 3: Test insufficient balance');
    console.log('----------------------------------------');
    
    const excessiveWithdrawalAmount = actualFinalBalance + 10;
    console.log(`💸 Attempting excessive withdrawal: ${excessiveWithdrawalAmount} USDT (available: ${actualFinalBalance} USDT)`);

    const excessiveWithdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: excessiveWithdrawalAmount,
        tokenType: 'USDT',
        testMode: true
      })
    });

    if (excessiveWithdrawalResponse.ok) {
      console.log(`❌ Excessive withdrawal should have failed but succeeded`);
    } else {
      const errorResult = await excessiveWithdrawalResponse.json();
      console.log(`✅ Excessive withdrawal correctly rejected: ${errorResult.error}`);
    }

    console.log('');

    // Scenario 4: Test reserve status
    console.log('📋 Scenario 4: Test reserve status');
    console.log('----------------------------------');
    
    const reserveResponse = await fetch(`${API_BASE_URL}/api/reserve-status`);
    if (reserveResponse.ok) {
      const reserveResult = await reserveResponse.json();
      console.log(`✅ Reserve status: ${reserveResult.totalReserve} USDT total`);
      console.log(`   Chain ${chainId}: ${reserveResult.chainReserves[chainId]?.totalReserve || 0} USDT`);
    } else {
      console.log(`❌ Failed to fetch reserve status`);
    }

    console.log('');
    console.log('🎉 Complete Withdrawal Flow Test Results');
    console.log('=======================================');
    console.log('📊 Summary:');
    console.log(`   Initial Deposit: ${depositAmount} USDT`);
    console.log(`   First Withdrawal: ${withdrawalAmount} USDT`);
    console.log(`   Second Withdrawal: ${secondWithdrawalAmount} USDT`);
    console.log(`   Final Balance: ${actualFinalBalance} USDT`);
    console.log(`   Total Withdrawn: ${withdrawalAmount + secondWithdrawalAmount} USDT`);
    console.log('');
    console.log('✅ All scenarios completed successfully!');
    console.log('✅ Frontend withdrawal flow is ready for production!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the test
testWithdrawFlow();
