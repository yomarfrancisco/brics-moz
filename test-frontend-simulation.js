#!/usr/bin/env node

/**
 * Frontend Simulation Test
 * Simulates exactly what the frontend does when a user initiates a withdrawal
 */

const API_BASE_URL = 'https://buybrics.vercel.app';

// Simulate the exact request the frontend makes
async function simulateFrontendWithdrawal() {
  console.log('🎭 Simulating Frontend Withdrawal Flow...\n');
  
  // Simulate the redeemUSDT function call from the frontend
  const userAddress = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
  const amount = 1;
  const chainId = 1;
  const testMode = false;
  
  console.log('📤 Frontend calling redeemUSDT with:');
  console.log(`  userAddress: ${userAddress}`);
  console.log(`  amount: ${amount}`);
  console.log(`  chainId: ${chainId}`);
  console.log(`  testMode: ${testMode}\n`);
  
  try {
    const normalizedAddress = userAddress.toLowerCase();
    console.log(`🔄 Normalized address: ${normalizedAddress}`);
    
    const requestBody = {
      userAddress: normalizedAddress,
      chainId: chainId,
      redeemAmount: amount,
      tokenType: "USDT",
      testMode: testMode
    };
    
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('📄 Response data:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      throw new Error(data.error || "Redemption failed");
    }
    
    // Simulate frontend success handling
    console.log('\n✅ Frontend would handle this as success:');
    console.log(`  txHash: ${data.txHash}`);
    console.log(`  newBalance: ${data.newBalance}`);
    console.log(`  onChainSuccess: ${data.onChainSuccess}`);
    
    // Simulate frontend balance refresh
    console.log('\n🔄 Frontend would now refresh user balance...');
    const balanceResponse = await fetch(`${API_BASE_URL}/api/deposits/${normalizedAddress}`);
    const balanceData = await balanceResponse.json();
    
    if (balanceData.success) {
      console.log('✅ Balance refresh successful');
      console.log(`  Total deposited: ${balanceData.totalUsdtDeposited} USDT`);
      console.log(`  Deposits count: ${balanceData.deposits?.length || 0}`);
    } else {
      console.log('❌ Balance refresh failed');
    }
    
    return {
      success: true,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      gasUsed: data.gasUsed,
      newBalance: data.newBalance,
      redeemedAmount: data.redeemedAmount,
      onChainSuccess: data.onChainSuccess,
      dryRun: data.dryRun,
      reserveBefore: data.reserveBefore,
      reserveAfter: data.reserveAfter,
      transferError: data.transferError
    };
    
  } catch (error) {
    console.error('❌ Frontend would handle this as error:', error.message);
    throw error;
  }
}

// Test the simulation
simulateFrontendWithdrawal()
  .then(result => {
    console.log('\n🎯 Frontend Simulation Complete!');
    console.log('The frontend withdrawal flow would work correctly.');
  })
  .catch(error => {
    console.error('\n💥 Frontend Simulation Failed!');
    console.error('The frontend would show an error to the user.');
  });
