#!/usr/bin/env node

/**
 * Test Enhanced Balance Logging
 * Simulates the new getUserDepositedAmount function with detailed logging
 */

const API_BASE_URL = 'https://buybrics.vercel.app';

async function testEnhancedBalanceLogging() {
  console.log('🔍 Testing Enhanced Balance Logging...\n');
  
  const userAddress = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
  
  try {
    const normalizedAddress = userAddress.toLowerCase();
    console.log(`[Balance] Fetching deposits for: ${normalizedAddress}`);
    
    const response = await fetch(`${API_BASE_URL}/api/deposits/${normalizedAddress}`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('[Balance] Failed to fetch deposits:', data.error);
      return;
    }
    
    const deposits = data.deposits || [];
    const withdrawals = data.withdrawals || [];
    const totalDeposited = data.totalUsdtDeposited || 0;
    
    console.log('[Balance] Raw data from API:', {
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length,
      totalDeposited: totalDeposited,
      deposits: deposits.map(d => ({
        amount: d.amount,
        currentBalance: d.currentBalance,
        chainId: d.chainId,
        txHash: d.txHash?.slice(0, 10) + '...'
      })),
      withdrawals: withdrawals.map(w => ({
        amount: w.amount,
        chainId: w.chainId,
        txHash: w.txHash?.slice(0, 10) + '...'
      }))
    });
    
    // Calculate total current balance across all deposits
    const totalCurrentBalance = deposits.reduce((sum, deposit) => {
      const balance = parseFloat(deposit.currentBalance) || 0;
      console.log(`[Balance] Deposit ${deposit._id}: amount=${deposit.amount}, currentBalance=${balance}`);
      return sum + balance;
    }, 0);
    
    // Calculate total withdrawn
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => {
      const amount = parseFloat(withdrawal.amount) || 0;
      console.log(`[Balance] Withdrawal ${withdrawal._id}: amount=${amount}`);
      return sum + amount;
    }, 0);
    
    console.log('[Balance] Calculated totals:', {
      totalDeposited: totalDeposited,
      totalCurrentBalance: totalCurrentBalance,
      totalWithdrawn: totalWithdrawn,
      netBalance: totalCurrentBalance - totalWithdrawn
    });
    
    // Check for potential balance display issues
    console.log('\n🔍 Balance Display Analysis:');
    
    if (totalCurrentBalance !== totalDeposited) {
      console.log('⚠️  Potential issue: totalCurrentBalance !== totalDeposited');
      console.log(`   totalCurrentBalance: ${totalCurrentBalance}`);
      console.log(`   totalDeposited: ${totalDeposited}`);
      console.log(`   Difference: ${totalDeposited - totalCurrentBalance}`);
    } else {
      console.log('✅ Balance calculation looks consistent');
    }
    
    // Check for deposits with high currentBalance vs amount
    const suspiciousDeposits = deposits.filter(d => {
      const amount = parseFloat(d.amount) || 0;
      const currentBalance = parseFloat(d.currentBalance) || 0;
      return currentBalance > amount * 1.5; // More than 50% higher
    });
    
    if (suspiciousDeposits.length > 0) {
      console.log('⚠️  Found deposits with unusually high currentBalance:');
      suspiciousDeposits.forEach(d => {
        console.log(`   Deposit ${d._id}: amount=${d.amount}, currentBalance=${d.currentBalance}`);
      });
    } else {
      console.log('✅ All deposits have reasonable currentBalance values');
    }
    
    return totalCurrentBalance;
    
  } catch (error) {
    console.error('[Balance] Error fetching user deposits:', error);
    return 0;
  }
}

testEnhancedBalanceLogging()
  .then(balance => {
    console.log(`\n🎯 Final calculated balance: ${balance} USDT`);
    console.log('Enhanced balance logging test completed!');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });
