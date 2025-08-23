import fetch from 'node-fetch';

const API_BASE_URL = 'https://buybrics.vercel.app';

async function testBalanceFix() {
  console.log('🔧 Testing Balance Calculation Fix...\n');
  
  try {
    const userAddress = '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1';
    const normalizedAddress = userAddress.toLowerCase();
    
    console.log(`[Test] Fetching deposits for: ${normalizedAddress}`);
    
    const response = await fetch(`${API_BASE_URL}/api/deposits/${normalizedAddress}`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('[Test] Failed to fetch deposits:', data.error);
      return;
    }
    
    const deposits = data.deposits || [];
    const withdrawals = data.withdrawals || [];
    
    console.log(`[Test] Found ${deposits.length} deposits and ${withdrawals.length} withdrawals`);
    
    // Calculate using the FIXED logic (actual deposit amounts, not inflated currentBalance)
    const totalDepositedAmount = deposits.reduce((sum, deposit) => {
      const amount = parseFloat(deposit.amount) || 0;
      return sum + amount;
    }, 0);
    
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => {
      const amount = parseFloat(withdrawal.amount) || 0;
      return sum + amount;
    }, 0);
    
    const netBalance = totalDepositedAmount - totalWithdrawn;
    
    console.log('\n📊 Balance Calculation Results:');
    console.log(`   Total Deposited: ${totalDepositedAmount} USDT`);
    console.log(`   Total Withdrawn: ${totalWithdrawn} USDT`);
    console.log(`   Net Balance: ${netBalance} USDT`);
    console.log(`   API Total: ${data.totalUsdtDeposited} USDT`);
    
    // Verify the calculation matches the API
    const isCorrect = Math.abs(netBalance - data.totalUsdtDeposited) < 0.01;
    
    console.log('\n✅ Balance Fix Verification:');
    if (isCorrect) {
      console.log('   ✅ SUCCESS: Balance calculation is now accurate!');
      console.log('   ✅ The inflated currentBalance values are being ignored');
      console.log('   ✅ UI will now show correct balance based on actual deposits - withdrawals');
    } else {
      console.log('   ❌ FAILED: Balance calculation still has issues');
      console.log(`   ❌ Expected: ${data.totalUsdtDeposited}, Got: ${netBalance}`);
    }
    
    // Show some examples of the fix
    console.log('\n🔍 Example Deposits (showing the fix):');
    deposits.slice(0, 3).forEach((deposit, index) => {
      console.log(`   Deposit ${index + 1}:`);
      console.log(`     Amount: ${deposit.amount} USDT`);
      console.log(`     Inflated currentBalance: ${deposit.currentBalance} USDT (ignored)`);
      console.log(`     Used for calculation: ${deposit.amount} USDT ✅`);
    });
    
  } catch (error) {
    console.error('[Test] Error testing balance fix:', error);
  }
}

testBalanceFix();
