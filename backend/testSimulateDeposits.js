#!/usr/bin/env node

// Test version of the deposit simulation script
// This demonstrates the logic without requiring a real MongoDB connection

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

// Safe float handling
function safeFloat(value) {
  return parseFloat(Number(value).toFixed(6));
}

// Simulate deposits
function createTestDeposits() {
  const deposits = [
    {
      userAddress: generateRandomAddress(),
      amount: 10,
      chainId: 8453, // Base
      txHash: generateRandomTxHash(),
      createdAt: new Date(),
    },
    {
      userAddress: generateRandomAddress(),
      amount: 20,
      chainId: 8453, // Base
      txHash: generateRandomTxHash(),
      createdAt: new Date(),
    },
    {
      userAddress: generateRandomAddress(),
      amount: 50,
      chainId: 1, // Ethereum
      txHash: generateRandomTxHash(),
      createdAt: new Date(),
    }
  ];

  return deposits.map(deposit => ({
    ...deposit,
    currentBalance: safeFloat(deposit.amount),
    accumulatedYield: 0,
    dailyYield: 0,
    dailyYieldPercent: 0.5,
    isTestData: true,
  }));
}

// Calculate yields based on time elapsed
function calculateYields(deposit, daysElapsed) {
  const amount = safeFloat(deposit.amount);
  const dailyYieldPercent = safeFloat(deposit.dailyYieldPercent);
  
  const accumulatedYield = safeFloat(amount * (dailyYieldPercent / 100) * daysElapsed);
  const currentBalance = safeFloat(amount + accumulatedYield);
  const dailyYield = safeFloat(amount * (dailyYieldPercent / 100));
  
  return {
    accumulatedYield,
    currentBalance,
    dailyYield,
  };
}

function testSimulation() {
  console.log('🧪 Testing Deposit Simulation Logic');
  console.log('===================================');
  
  // Create test deposits
  const deposits = createTestDeposits();
  
  console.log('\n💰 Initial Test Deposits:');
  deposits.forEach((deposit, index) => {
    console.log(`\n${index + 1}. ${deposit.userAddress.slice(0, 8)}...${deposit.userAddress.slice(-6)}`);
    console.log(`   Amount: ${deposit.amount} USDT`);
    console.log(`   Chain: ${deposit.chainId}`);
    console.log(`   Current Balance: ${deposit.currentBalance} USDT`);
    console.log(`   Accumulated Yield: ${deposit.accumulatedYield} USDT`);
    console.log(`   Daily Yield %: ${deposit.dailyYieldPercent}%`);
  });
  
  // Simulate time progression
  console.log('\n⏰ Simulating Yield Growth Over Time:');
  console.log('=====================================');
  
  const timeIntervals = [0.1, 0.5, 1, 2, 5, 10]; // Days
  
  timeIntervals.forEach(days => {
    console.log(`\n📅 After ${days} day(s):`);
    console.log('─'.repeat(50));
    
    deposits.forEach((deposit, index) => {
      const yields = calculateYields(deposit, days);
      
      console.log(`${index + 1}. ${deposit.userAddress.slice(0, 8)}...${deposit.userAddress.slice(-6)}:`);
      console.log(`   Original Amount: ${deposit.amount} USDT`);
      console.log(`   Days Elapsed: ${days}`);
      console.log(`   Accumulated Yield: ${yields.accumulatedYield.toFixed(6)} USDT`);
      console.log(`   Current Balance: ${yields.currentBalance.toFixed(6)} USDT`);
      console.log(`   Daily Yield: ${yields.dailyYield.toFixed(6)} USDT`);
      console.log(`   Total Growth: ${((yields.currentBalance / deposit.amount - 1) * 100).toFixed(4)}%`);
    });
  });
  
  // Show calculation examples
  console.log('\n🧮 Calculation Examples:');
  console.log('========================');
  
  const exampleDeposit = deposits[0]; // 10 USDT deposit
  const exampleDays = 1;
  const exampleYields = calculateYields(exampleDeposit, exampleDays);
  
  console.log(`\nExample: ${exampleDeposit.amount} USDT deposit with ${exampleDeposit.dailyYieldPercent}% daily yield`);
  console.log(`After ${exampleDays} day:`);
  console.log(`  Daily Yield = ${exampleDeposit.amount} × (${exampleDeposit.dailyYieldPercent}% ÷ 100) = ${exampleYields.dailyYield.toFixed(6)} USDT`);
  console.log(`  Accumulated Yield = ${exampleYields.dailyYield.toFixed(6)} × ${exampleDays} = ${exampleYields.accumulatedYield.toFixed(6)} USDT`);
  console.log(`  Current Balance = ${exampleDeposit.amount} + ${exampleYields.accumulatedYield.toFixed(6)} = ${exampleYields.currentBalance.toFixed(6)} USDT`);
  
  console.log('\n💡 Note: This is a test run. Use simulateDeposits.js for actual database simulation.');
}

testSimulation();
