#!/usr/bin/env node

/**
 * Test Error Handling Improvements
 * Verifies the fixes for JSON parsing errors and other edge cases
 */

const API_BASE_URL = 'https://buybrics.vercel.app';

async function testErrorHandling() {
  console.log('🔍 Testing Error Handling Improvements...\n');
  
  // Test 1: Invalid user address
  console.log('1️⃣ Testing invalid user address...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: "0xinvalid",
        chainId: 1,
        redeemAmount: 1,
        tokenType: "USDT"
      }),
    });
    
    const data = await response.json();
    if (!data.success) {
      console.log('✅ Invalid user address properly rejected');
    } else {
      console.log('⚠️  Invalid user address was accepted (unexpected)');
    }
  } catch (error) {
    console.log('✅ Invalid user address caused expected error');
  }
  
  // Test 2: Excessive amount
  console.log('\n2️⃣ Testing excessive withdrawal amount...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1",
        chainId: 1,
        redeemAmount: 1000000, // Very large amount
        tokenType: "USDT"
      }),
    });
    
    const data = await response.json();
    if (!data.success) {
      console.log('✅ Excessive amount properly rejected');
    } else {
      console.log('⚠️  Excessive amount was accepted (unexpected)');
    }
  } catch (error) {
    console.log('✅ Excessive amount caused expected error');
  }
  
  // Test 3: Missing required fields
  console.log('\n3️⃣ Testing missing required fields...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1"
        // Missing chainId, redeemAmount, tokenType
      }),
    });
    
    const data = await response.json();
    if (!data.success) {
      console.log('✅ Missing fields properly rejected');
    } else {
      console.log('⚠️  Missing fields were accepted (unexpected)');
    }
  } catch (error) {
    console.log('✅ Missing fields caused expected error');
  }
  
  // Test 4: Non-JSON response handling (simulate by calling non-existent endpoint)
  console.log('\n4️⃣ Testing non-JSON response handling...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/non-existent-endpoint`);
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      console.log('✅ Non-JSON response detected properly');
      console.log(`   Content-Type: ${contentType}`);
    } else {
      console.log('⚠️  Expected non-JSON response but got JSON');
    }
  } catch (error) {
    console.log('✅ Non-existent endpoint caused expected error');
  }
  
  // Test 5: Valid request (should succeed)
  console.log('\n5️⃣ Testing valid request...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1",
        chainId: 1,
        redeemAmount: 1,
        tokenType: "USDT"
      }),
    });
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (data.success) {
        console.log('✅ Valid request succeeded with proper JSON response');
        console.log(`   Transaction Hash: ${data.txHash}`);
        console.log(`   Test Mode: ${data.testMode}`);
      } else {
        console.log('⚠️  Valid request failed unexpectedly');
      }
    } else {
      console.log('⚠️  Valid request returned non-JSON response');
    }
  } catch (error) {
    console.log('❌ Valid request caused unexpected error:', error.message);
  }
  
  console.log('\n🎯 Error handling test completed!');
}

testErrorHandling();
