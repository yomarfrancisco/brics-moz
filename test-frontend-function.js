#!/usr/bin/env node

/**
 * Test if redeemUSDT function exists in deployed frontend
 */

const API_BASE_URL = 'https://buybrics.vercel.app';

async function testFrontendFunction() {
  console.log('🔍 Testing Frontend Function Availability...\n');
  
  try {
    // Fetch the main HTML to get the JS bundle URL
    const htmlResponse = await fetch(`${API_BASE_URL}/`);
    const html = await htmlResponse.text();
    
    // Extract the JS bundle URL
    const jsMatch = html.match(/index-[^"]*\.js/);
    if (!jsMatch) {
      console.log('❌ Could not find JS bundle in HTML');
      return;
    }
    
    const jsBundleUrl = `${API_BASE_URL}/assets/${jsMatch[0]}`;
    console.log(`📦 JS Bundle: ${jsBundleUrl}`);
    
    // Fetch the JS bundle
    const jsResponse = await fetch(jsBundleUrl);
    const jsCode = await jsResponse.text();
    
    // Check for redeemUSDT function
    const hasRedeemUSDT = jsCode.includes('redeemUSDT');
    const hasRedeemFunction = jsCode.includes('redeemUSDT');
    const hasAPIBaseURL = jsCode.includes('API_BASE_URL');
    
    console.log('\n🔍 Function Check Results:');
    console.log(`  redeemUSDT function: ${hasRedeemUSDT ? '✅ Found' : '❌ Not found'}`);
    console.log(`  API_BASE_URL: ${hasAPIBaseURL ? '✅ Found' : '❌ Not found'}`);
    
    if (hasRedeemUSDT) {
      console.log('\n✅ Frontend has redeemUSDT function!');
      console.log('   Users should be able to withdraw successfully.');
    } else {
      console.log('\n❌ Frontend missing redeemUSDT function!');
      console.log('   Users will see JavaScript errors when trying to withdraw.');
      console.log('   Need to force frontend rebuild.');
    }
    
    // Check bundle size
    const bundleSizeKB = Math.round(jsCode.length / 1024);
    console.log(`\n📊 Bundle size: ${bundleSizeKB} KB`);
    
  } catch (error) {
    console.error('❌ Error testing frontend:', error.message);
  }
}

testFrontendFunction();
