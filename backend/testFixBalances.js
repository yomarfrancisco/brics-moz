#!/usr/bin/env node

// Test version of the balance fixer script
// This demonstrates the logic without requiring a real MongoDB connection

function calculateCorrectBalance(amount, accumulatedYield) {
  const parsedAmount = Number(amount) || 0;
  const parsedAccumulatedYield = Number(accumulatedYield) || 0;
  return parsedAmount + parsedAccumulatedYield;
}

function needsFixing(currentBalance, correctBalance) {
  const parsedCurrentBalance = Number(currentBalance) || 0;
  return Math.abs(parsedCurrentBalance - correctBalance) > 0.001;
}

// Sample test data based on the production API response
const testDeposits = [
  {
    _id: "68a84269b99e5683345d43c5",
    userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    amount: 1,
    currentBalance: 2,
    accumulatedYield: 0,
    chainId: 1,
    txHash: "0xd8ed7ec4c5339044171d758d943ebe5e41d96630814bb1d19ee0c370fc407cac"
  },
  {
    _id: "68a84311944d7443ae7329f6",
    userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    amount: 1,
    currentBalance: 2,
    accumulatedYield: 0,
    chainId: 1,
    txHash: "0xb5956be12cceacdbfd4bbb602053a3ac84eb598250dfbfe0461837f4130f52e5"
  },
  {
    _id: "68a8c7221bba02a1ffa13198",
    userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    amount: 10,
    currentBalance: 30,
    accumulatedYield: 0,
    chainId: 8453,
    txHash: "testtx1234567890"
  },
  {
    _id: "68a8d7ca8d7b9a71497b1f7c",
    userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    amount: 25,
    currentBalance: 30,
    accumulatedYield: 0,
    chainId: 8453,
    txHash: "testtx0987654321"
  }
];

function testFixBalances() {
  console.log('🧪 Testing Balance Fixer Logic');
  console.log('==============================');
  
  let fixedCount = 0;
  let unchangedCount = 0;
  const updatedDeposits = [];
  
  for (const deposit of testDeposits) {
    const { _id, amount, accumulatedYield, currentBalance, userAddress, txHash, chainId } = deposit;
    
    const correctBalance = calculateCorrectBalance(amount, accumulatedYield);
    
    if (needsFixing(currentBalance, correctBalance)) {
      console.log(`🔧 Would fix deposit ${_id}:`);
      console.log(`   User: ${userAddress}`);
      console.log(`   Chain: ${chainId}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Accumulated Yield: ${accumulatedYield}`);
      console.log(`   Old Balance: ${currentBalance}`);
      console.log(`   New Balance: ${correctBalance}`);
      console.log(`   Difference: ${correctBalance - currentBalance}`);
      
      updatedDeposits.push({
        id: _id,
        userAddress,
        chainId,
        oldBalance: currentBalance,
        newBalance: correctBalance,
        difference: correctBalance - currentBalance,
        txHash
      });
      
      fixedCount++;
    } else {
      unchangedCount++;
    }
  }
  
  console.log('\n📋 Test Results:');
  console.log(`✅ Would fix: ${fixedCount} deposits`);
  console.log(`ℹ️  Unchanged: ${unchangedCount} deposits`);
  console.log(`📊 Total processed: ${testDeposits.length} deposits`);
  
  if (updatedDeposits.length > 0) {
    console.log('\n📝 Deposits that would be updated:');
    updatedDeposits.forEach((deposit, index) => {
      console.log(`\n${index + 1}. Deposit ID: ${deposit.id}`);
      console.log(`   User: ${deposit.userAddress}`);
      console.log(`   Chain: ${deposit.chainId}`);
      console.log(`   Old Balance: ${deposit.oldBalance}`);
      console.log(`   New Balance: ${deposit.newBalance}`);
      console.log(`   Difference: ${deposit.difference > 0 ? '+' : ''}${deposit.difference}`);
      console.log(`   TX Hash: ${deposit.txHash}`);
    });
  }
  
  console.log('\n💡 Note: This is a test run. Use fixBalances.js for actual database updates.');
}

testFixBalances();
