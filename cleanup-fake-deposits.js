import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function cleanupFakeDeposits() {
  console.log('🧹 Starting cleanup of fake and inflated deposits...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('brics-production');
    const depositsCollection = db.collection('deposits');
    
    // 1. Find and analyze suspicious deposits
    console.log('\n📊 Analyzing deposits for suspicious patterns...');
    
    const suspiciousDeposits = await depositsCollection.find({
      $or: [
        { amount: { $gte: 100 } }, // Large deposits
        { txHash: { $in: [null, "", "0x", "test", "mock"] } }, // Missing or fake tx hashes
        { currentBalance: { $gte: 100 } } // Inflated balances
      ]
    }).toArray();
    
    console.log(`Found ${suspiciousDeposits.length} suspicious deposits:`);
    
    suspiciousDeposits.forEach(deposit => {
      console.log(`  - User: ${deposit.userAddress}`);
      console.log(`    Amount: ${deposit.amount} USDT`);
      console.log(`    Current Balance: ${deposit.currentBalance} USDT`);
      console.log(`    TX Hash: ${deposit.txHash || 'NULL'}`);
      console.log(`    Timestamp: ${deposit.timestamp}`);
      console.log(`    Chain ID: ${deposit.chainId}`);
      console.log('');
    });
    
    // 2. Clean up specific fake deposits
    console.log('🗑️ Cleaning up fake deposits...');
    
    // Remove the specific fake $100 deposit
    const fake100Result = await depositsCollection.deleteOne({
      userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
      amount: 100
    });
    
    console.log(`✅ Removed ${fake100Result.deletedCount} fake $100 deposit(s)`);
    
    // Remove deposits with missing or fake transaction hashes
    const fakeTxResult = await depositsCollection.deleteMany({
      txHash: { $in: [null, "", "0x", "test", "mock", "0xmainnettest123", "0xmainnettest456"] }
    });
    
    console.log(`✅ Removed ${fakeTxResult.deletedCount} deposits with fake transaction hashes`);
    
    // Remove deposits where currentBalance is significantly inflated (>10x the amount)
    const inflatedResult = await depositsCollection.deleteMany({
      $expr: {
        $and: [
          { $gt: ["$currentBalance", 10] },
          { $lt: ["$amount", 1] },
          { $gt: [{ $divide: ["$currentBalance", "$amount"] }, 10] }
        ]
      }
    });
    
    console.log(`✅ Removed ${inflatedResult.deletedCount} deposits with inflated balances`);
    
    // 3. Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    
    const remainingDeposits = await depositsCollection.find({
      userAddress: "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1"
    }).toArray();
    
    console.log(`\n📊 Remaining deposits for test wallet:`);
    remainingDeposits.forEach(deposit => {
      console.log(`  - Amount: ${deposit.amount} USDT`);
      console.log(`    Current Balance: ${deposit.currentBalance} USDT`);
      console.log(`    TX Hash: ${deposit.txHash}`);
      console.log(`    Timestamp: ${deposit.timestamp}`);
    });
    
    // 4. Summary
    const totalRemaining = await depositsCollection.countDocuments();
    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Total deposits remaining in database: ${totalRemaining}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupFakeDeposits();
