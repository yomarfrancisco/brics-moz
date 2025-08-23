import fetch from 'node-fetch';

async function testRedemption() {
  try {
    console.log('🔄 Testing redemption logic...');
    
    const redemptionData = {
      userAddress: '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1',
      amount: 5,
      tokenType: 'USDT',
      chainId: 8453
    };
    
    console.log('📤 Sending redemption request:', redemptionData);
    
    // First, check current deposits
    const depositsResponse = await fetch('http://localhost:4000/api/deposits/0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1');
    const depositsData = await depositsResponse.json();
    
    console.log('📊 Current deposits:', depositsData);
    
    // Try to call a redemption endpoint (if it exists)
    try {
      const redemptionResponse = await fetch('http://localhost:4000/api/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(redemptionData)
      });
      
      if (redemptionResponse.ok) {
        const redemptionResult = await redemptionResponse.json();
        console.log('✅ Redemption successful:', redemptionResult);
      } else {
        console.log('❌ Redemption endpoint not found or failed');
        console.log('   Status:', redemptionResponse.status);
        console.log('   This is expected - no redemption endpoint exists yet');
      }
    } catch (error) {
      console.log('❌ Redemption endpoint not available');
      console.log('   This is expected - no redemption endpoint exists yet');
    }
    
    // Test withdrawal instead (which exists)
    console.log('\n🔄 Testing withdrawal (alternative to redemption)...');
    
    const withdrawalData = {
      userAddress: '0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1',
      amount: 5,
      chainId: 8453,
      txHash: '0xredemption' + Date.now()
    };
    
    const withdrawalResponse = await fetch('http://localhost:4000/api/withdrawals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const withdrawalResult = await withdrawalResponse.json();
    console.log('✅ Withdrawal test result:', withdrawalResult);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing redemption:', error);
    process.exit(1);
  }
}

testRedemption();
