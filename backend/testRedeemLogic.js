#!/usr/bin/env node

// Standalone test script for redeem logic
// This demonstrates the redemption logic without requiring the server to be running

// Mock crypto for transaction hash generation
function generateMockTxHash() {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Mock deposit data
const mockDeposits = [
  {
    _id: 'deposit1',
    userAddress: '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1',
    amount: 100,
    currentBalance: 100,
    chainId: 8453,
    tokenType: 'USDT',
    isTestData: false
  },
  {
    _id: 'deposit2',
    userAddress: '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1',
    amount: 50,
    currentBalance: 50,
    chainId: 8453,
    tokenType: 'USDT',
    isTestData: false
  }
];

// Simulate redemption logic
function simulateRedemption(userAddress, chainId, redeemAmount, tokenType) {
  console.log(`\n🔄 Simulating redemption:`);
  console.log(`   User: ${userAddress}`);
  console.log(`   Chain: ${chainId}`);
  console.log(`   Amount: ${redeemAmount} ${tokenType}`);
  
  // Input validation
  const errors = [];
  if (!userAddress || typeof userAddress !== 'string') errors.push('userAddress is missing or invalid');
  if (!chainId || typeof chainId !== 'number') errors.push('chainId is missing or not a number');
  if (!redeemAmount || typeof redeemAmount !== 'number' || isNaN(redeemAmount) || redeemAmount <= 0) errors.push('redeemAmount is missing, not a number, or invalid');
  if (!tokenType || typeof tokenType !== 'string') errors.push('tokenType is missing or invalid');

  if (errors.length > 0) {
    console.log('❌ Validation errors:', errors);
    return { success: false, error: 'Validation failed', details: errors };
  }

  // Validate chainId
  if (![1, 8453].includes(chainId)) {
    console.log('❌ Invalid chainId. Supported chains: 1 (Ethereum), 8453 (Base)');
    return { success: false, error: 'Invalid chainId. Supported chains: 1 (Ethereum), 8453 (Base)' };
  }

  // Find user's deposits (excluding test data)
  const userDeposits = mockDeposits.filter(deposit => 
    deposit.userAddress.toLowerCase() === userAddress.toLowerCase() &&
    deposit.chainId === chainId &&
    !deposit.isTestData
  );

  if (userDeposits.length === 0) {
    console.log('❌ No deposits found for this user address and chain');
    return { success: false, error: 'No deposits found for this user address and chain' };
  }

  // Calculate total available balance
  const totalBalance = userDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);

  if (redeemAmount > totalBalance) {
    console.log('❌ Insufficient balance for redemption');
    console.log(`   Requested: ${redeemAmount} USDT`);
    console.log(`   Available: ${totalBalance} USDT`);
    console.log(`   Shortfall: ${redeemAmount - totalBalance} USDT`);
    return { 
      success: false, 
      error: 'Insufficient balance for redemption',
      details: {
        requestedAmount: redeemAmount,
        availableBalance: totalBalance,
        shortfall: redeemAmount - totalBalance
      }
    };
  }

  // Generate mock transaction hash
  const mockTxHash = generateMockTxHash();

  // Update deposits proportionally
  let remainingRedeemAmount = redeemAmount;
  const updatedDeposits = [];

  console.log('\n📊 Processing redemption across deposits:');

  for (const deposit of userDeposits) {
    if (remainingRedeemAmount <= 0) break;

    const currentBalance = parseFloat(deposit.currentBalance) || 0;
    if (currentBalance <= 0) continue;

    // Calculate how much to redeem from this deposit
    const redeemFromThisDeposit = Math.min(remainingRedeemAmount, currentBalance);
    const newBalance = currentBalance - redeemFromThisDeposit;
    remainingRedeemAmount -= redeemFromThisDeposit;

    // Update the deposit
    const updatedDeposit = {
      ...deposit,
      currentBalance: newBalance,
      lastRedeemedAt: new Date(),
      lastRedeemedAmount: redeemFromThisDeposit,
      lastRedeemedTxHash: mockTxHash
    };

    updatedDeposits.push(updatedDeposit);
    
    console.log(`   Deposit ${deposit._id}:`);
    console.log(`     Balance: ${currentBalance} → ${newBalance} USDT`);
    console.log(`     Redeemed: ${redeemFromThisDeposit} USDT`);
  }

  // Calculate new total balance
  const newTotalBalance = updatedDeposits.reduce((sum, deposit) => sum + (deposit.currentBalance || 0), 0);

  console.log(`\n✅ Redemption completed successfully!`);
  console.log(`   Transaction Hash: ${mockTxHash}`);
  console.log(`   New Total Balance: ${newTotalBalance} USDT`);

  return {
    success: true,
    status: 'success',
    newBalance: newTotalBalance,
    txHash: mockTxHash,
    redeemedAmount: redeemAmount,
    userAddress: userAddress.toLowerCase(),
    chainId: chainId,
    tokenType: tokenType.toUpperCase()
  };
}

// Test scenarios
function runTests() {
  console.log('🧪 Testing Redeem Logic');
  console.log('=======================');
  
  const testUser = '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1';
  
  console.log('\n💰 Initial deposit state:');
  mockDeposits.forEach((deposit, index) => {
    console.log(`   ${index + 1}. Deposit ${deposit._id}: ${deposit.currentBalance} USDT`);
  });
  
  // Test 1: Valid partial redemption
  console.log('\n📋 Test 1: Valid Partial Redemption (25 USDT)');
  const test1 = simulateRedemption(testUser, 8453, 25, 'USDT');
  console.log('Result:', test1.success ? '✅ PASS' : '❌ FAIL');
  
  // Test 2: Another partial redemption
  console.log('\n📋 Test 2: Another Partial Redemption (30 USDT)');
  const test2 = simulateRedemption(testUser, 8453, 30, 'USDT');
  console.log('Result:', test2.success ? '✅ PASS' : '❌ FAIL');
  
  // Test 3: Over-redemption (should fail)
  console.log('\n📋 Test 3: Over-Redemption (200 USDT - should fail)');
  const test3 = simulateRedemption(testUser, 8453, 200, 'USDT');
  console.log('Result:', test3.success ? '❌ FAIL (should have failed)' : '✅ PASS (correctly rejected)');
  
  // Test 4: Invalid chainId
  console.log('\n📋 Test 4: Invalid Chain ID (999)');
  const test4 = simulateRedemption(testUser, 999, 10, 'USDT');
  console.log('Result:', test4.success ? '❌ FAIL (should have failed)' : '✅ PASS (correctly rejected)');
  
  // Test 5: Invalid user address
  console.log('\n📋 Test 5: Invalid User Address (empty)');
  const test5 = simulateRedemption('', 8453, 10, 'USDT');
  console.log('Result:', test5.success ? '❌ FAIL (should have failed)' : '✅ PASS (correctly rejected)');
  
  console.log('\n🎉 All tests completed!');
  console.log('\n💡 This demonstrates the redeem logic. Use testRedeem.js for full server testing.');
}

runTests();
