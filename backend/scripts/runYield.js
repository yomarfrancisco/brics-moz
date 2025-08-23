import { updateYieldFromSheet } from '../sheets.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function runYieldAccrual() {
  try {
    console.log('🚀 Starting yield accrual simulation...');
    
    // Call the yield update function
    const updates = await updateYieldFromSheet();
    
    console.log('✅ Yield accrual completed successfully!');
    console.log(`📊 Updated ${updates.length} deposits with yield calculations`);
    
    // Log the updates
    updates.forEach((update, index) => {
      console.log(`\n📈 Update ${index + 1}:`);
      console.log(`   User: ${update.userAddress}`);
      console.log(`   Chain: ${update.chainId}`);
      console.log(`   Current Balance: ${update.currentBalance}`);
      console.log(`   Accumulated Yield: ${update.accumulatedYield}`);
      console.log(`   Daily Yield: ${update.dailyYield}`);
      console.log(`   Daily Yield %: ${update.dailyYieldPercent}%`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running yield accrual:', error);
    process.exit(1);
  }
}

runYieldAccrual();
