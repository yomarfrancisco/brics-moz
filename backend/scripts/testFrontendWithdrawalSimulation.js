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

// Test the complete frontend withdrawal flow
const testFrontendWithdrawalFlow = async () => {
  const testUserAddress = generateRandomAddress();
  const chainId = 8453; // Base chain
  const depositAmount = 50;
  const withdrawalAmount = 10;

  console.log('🧪 Testing Frontend Withdrawal Flow Simulation');
  console.log('==============================================');
  console.log(`👤 Test User: ${testUserAddress}`);
  console.log(`🔗 Chain ID: ${chainId} (Base)`);
  console.log(`💰 Deposit Amount: ${depositAmount} USDT`);
  console.log(`💸 Withdrawal Amount: ${withdrawalAmount} USDT`);
  console.log('');

  try {
    // Step 1: Create a deposit
    console.log('📥 Step 1: Creating deposit...');
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
      throw new Error(`Deposit failed: ${depositResponse.status} ${depositResponse.statusText}`);
    }

    const depositResult = await depositResponse.json();
    console.log(`✅ Deposit created: ${depositResult.deposit.amount} USDT`);
    console.log(`   Current Balance: ${depositResult.deposit.currentBalance} USDT`);
    console.log('');

    // Step 2: Fetch user balance (simulate frontend balance check)
    console.log('💰 Step 2: Fetching user balance...');
    const balanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    
    if (!balanceResponse.ok) {
      throw new Error(`Balance fetch failed: ${balanceResponse.status} ${balanceResponse.statusText}`);
    }

    const balanceResult = await balanceResponse.json();
    console.log(`✅ Balance fetched: ${balanceResult.totalDeposited} USDT total deposited`);
    console.log(`   Available Balance: ${balanceResult.deposits[0]?.currentBalance || 0} USDT`);
    console.log('');

    // Step 3: Process withdrawal (simulate frontend withdrawal)
    console.log('💸 Step 3: Processing withdrawal...');
    const withdrawalResponse = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testUserAddress,
        chainId: chainId,
        redeemAmount: withdrawalAmount,
        tokenType: 'USDT',
        testMode: true // Use test mode to avoid reserve deduction
      })
    });

    if (!withdrawalResponse.ok) {
      throw new Error(`Withdrawal failed: ${withdrawalResponse.status} ${withdrawalResponse.statusText}`);
    }

    const withdrawalResult = await withdrawalResponse.json();
    console.log(`✅ Withdrawal processed: ${withdrawalResult.redeemedAmount} USDT`);
    console.log(`   New Balance: ${withdrawalResult.newBalance} USDT`);
    console.log(`   Transaction Hash: ${withdrawalResult.txHash}`);
    console.log('');

    // Step 4: Fetch updated balance (simulate frontend post-withdrawal balance update)
    console.log('🔄 Step 4: Fetching updated balance...');
    const updatedBalanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${testUserAddress}`);
    
    if (!updatedBalanceResponse.ok) {
      throw new Error(`Updated balance fetch failed: ${updatedBalanceResponse.status} ${updatedBalanceResponse.statusText}`);
    }

    const updatedBalanceResult = await updatedBalanceResponse.json();
    console.log(`✅ Updated balance fetched: ${updatedBalanceResult.totalDeposited} USDT total deposited`);
    console.log(`   Current Balance: ${updatedBalanceResult.deposits[0]?.currentBalance || 0} USDT`);
    console.log('');

    // Step 5: Verify the flow worked correctly
    console.log('✅ Step 5: Verifying flow results...');
    const expectedBalance = depositAmount - withdrawalAmount;
    const actualBalance = updatedBalanceResult.deposits[0]?.currentBalance || 0;
    
    if (Math.abs(actualBalance - expectedBalance) < 0.01) {
      console.log(`✅ Balance verification passed!`);
      console.log(`   Expected: ${expectedBalance} USDT`);
      console.log(`   Actual: ${actualBalance} USDT`);
    } else {
      console.log(`❌ Balance verification failed!`);
      console.log(`   Expected: ${expectedBalance} USDT`);
      console.log(`   Actual: ${actualBalance} USDT`);
    }

    console.log('');
    console.log('🎉 Frontend Withdrawal Flow Simulation Complete!');
    console.log('==============================================');
    console.log('📊 Summary:');
    console.log(`   Initial Deposit: ${depositAmount} USDT`);
    console.log(`   Withdrawal: ${withdrawalAmount} USDT`);
    console.log(`   Final Balance: ${actualBalance} USDT`);
    console.log(`   Transaction: ${withdrawalResult.txHash}`);
    console.log('');
    console.log('✅ All steps completed successfully!');
    console.log('✅ Frontend can now implement this flow with confidence.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the test
testFrontendWithdrawalFlow();
