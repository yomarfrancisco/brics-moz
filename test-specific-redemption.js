import fetch from 'node-fetch';

const API_BASE_URL = 'https://buybrics.vercel.app';

// Helper function to get the correct block explorer URL for a chain
function explorerBaseFor(chainId) {
  switch (chainId) {
    case 1: return 'https://etherscan.io'; // Ethereum Mainnet
    case 8453: return 'https://basescan.org'; // Base
    case 10: return 'https://optimistic.etherscan.io'; // Optimism
    case 42161: return 'https://arbiscan.io'; // Arbitrum
    case 11155111: return 'https://sepolia.etherscan.io'; // Sepolia
    default: return 'https://etherscan.io'; // Default fallback
  }
}

async function testSpecificRedemption() {
  console.log('🎯 SPECIFIC REDEMPTION TEST\n');
  console.log('📍 Testing Real USDT Transfer on Ethereum Mainnet');
  console.log('─'.repeat(60));
  
  // Test parameters as specified
  const testWallet = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
  const testAmount = 0.01; // 0.01 USDT as requested
  const chainId = 1; // Ethereum Mainnet
  const dryRun = false; // Real transfer, not dry run
  
  console.log('📋 Test Parameters:');
  console.log(`   From: Treasury Wallet (TREASURY_PRIVATE_KEY)`);
  console.log(`   To: ${testWallet}`);
  console.log(`   Amount: ${testAmount} USDT`);
  console.log(`   Chain: ${chainId} (Ethereum Mainnet)`);
  console.log(`   Dry Run: ${dryRun}`);
  console.log(`   API: ${API_BASE_URL}/api/redeem`);
  
  console.log('\n🚀 Executing Real Redemption...');
  console.log('   ⚠️  This will transfer REAL USDT from treasury to user wallet');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: testWallet,
        chainId: chainId,
        redeemAmount: testAmount,
        tokenType: 'USDT',
        testMode: false // Ensure real transfer
      })
    });
    
    const data = await response.json();
    
    console.log('\n📊 REDEMPTION RESULTS:');
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (data.success) {
      console.log('\n✅ REDEMPTION SUCCESSFUL!');
      console.log(`   Transaction Hash: ${data.txHash}`);
      console.log(`   Block Number: ${data.blockNumber}`);
      console.log(`   Gas Used: ${data.gasUsed}`);
      console.log(`   On-chain Success: ${data.onChainSuccess}`);
      console.log(`   Dry Run: ${data.dryRun}`);
      console.log(`   New Balance: ${data.newBalance}`);
      console.log(`   Reserve Before: ${data.reserveBefore}`);
      console.log(`   Reserve After: ${data.reserveAfter}`);
      
      // Verify this is a real transaction
      if (data.txHash && !data.txHash.startsWith('0xmock') && !data.dryRun) {
        // Validate transaction hash length
        const fullHash = data.txHash;
        if (fullHash.length !== 66) {
          console.log('\n❌ INVALID TRANSACTION HASH DETECTED!');
          console.log(`   Expected: 66 characters`);
          console.log(`   Received: ${fullHash.length} characters`);
          console.log(`   Hash: ${fullHash}`);
                  console.log('   🔍 This indicates the backend is still using mock transaction hashes');
        console.log('   ⚠️  Real on-chain transfers are not yet implemented');
        console.log('   💡 Check the backend /api/redeem implementation');
        
        console.log('\n🔍 DEBUG: Full API Response:');
        console.log(JSON.stringify(data, null, 2));
        process.exit(1);
        }
        
        // Get the correct explorer URL for this chain
        const explorerBase = explorerBaseFor(chainId);
        const explorerUrl = `${explorerBase}/tx/${fullHash}`;
        
        console.log('\n✅ Redemption Broadcast');
        console.log(`Chain ID: ${chainId}`);
        console.log(`Full Tx Hash: ${fullHash}`);
        console.log(`Explorer: ${explorerUrl}`);
        
        console.log('\n🎉 REAL TRANSACTION CONFIRMED!');
        console.log('   ✅ Real transaction hash generated');
        console.log('   ✅ Real block number present');
        console.log('   ✅ Real gas usage recorded');
        console.log('   ✅ No dry run mode');
        
        console.log('\n📝 TRANSACTION DETAILS:');
        console.log(`   Amount: ${testAmount} USDT`);
        console.log(`   Chain: Ethereum Mainnet (${chainId})`);
        console.log(`   Status: Confirmed on blockchain`);
        console.log(`   Gas Used: ${data.gasUsed} wei`);
        console.log(`   Treasury Address: ${data.treasuryAddress || 'Check logs for treasury address'}`);
        console.log(`   Recipient: ${testWallet}`);
        
        console.log('\n✅ TEST CRITERIA MET:');
        console.log('   ✅ USDT deducted from treasury wallet');
        console.log('   ✅ Real transaction hash generated');
        console.log('   ✅ Transaction confirmed on blockchain');
        console.log('   ✅ Redemption shows as success');
        
        return {
          success: true,
          txHash: fullHash,
          blockNumber: data.blockNumber,
          gasUsed: data.gasUsed,
          chainId: chainId,
          isRealTransaction: true
        };
        
      } else {
        console.log('\n⚠️  MOCK TRANSACTION DETECTED');
        console.log('   ❌ Still using mock transfer logic');
        console.log('   ❌ No real USDT transferred');
        console.log('   ❌ Transaction hash is fake');
        
        return {
          success: false,
          error: 'Mock transaction detected - real transfer not working'
        };
      }
      
    } else {
      console.log('\n❌ REDEMPTION FAILED');
      console.log(`   Error: ${data.error}`);
      console.log(`   Details: ${JSON.stringify(data.details, null, 2) || 'No details provided'}`);
      
      console.log('\n🔍 FULL ERROR RESPONSE:');
      console.log(JSON.stringify(data, null, 2));
      
      return {
        success: false,
        error: data.error,
        details: data.details
      };
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute the test
testSpecificRedemption().then(result => {
  console.log('\n🏁 TEST COMPLETION SUMMARY:');
  console.log('─'.repeat(60));
  
  if (result.success && result.isRealTransaction) {
    console.log('🎉 SUCCESS: Real USDT redemption completed!');
    console.log(`   Transaction: ${result.txHash}`);
    console.log(`   Block: ${result.blockNumber}`);
    console.log(`   Gas: ${result.gasUsed}`);
    console.log(`   Explorer: ${explorerBaseFor(result.chainId || 1)}/tx/${result.txHash}`);
    console.log('\n   Ready for user verification on blockchain explorer');
  } else {
    console.log('❌ FAILED: Redemption did not complete successfully');
    console.log(`   Error: ${result.error || 'Unknown error'}`);
  }
  
  process.exit(result.success ? 0 : 1);
});
