import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined');
  process.exit(1);
}

// Deposit Schema
const depositSchema = new mongoose.Schema({
  userAddress: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currentBalance: { type: Number, default: 0 },
  accumulatedYield: { type: Number, default: 0 },
  dailyYieldPercent: { type: Number, default: 0.5 },
  timestamp: { type: Date, default: Date.now },
  txHash: { type: String },
  chainId: { type: Number, required: true },
  tokenType: { type: String, default: 'USDT' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Withdrawal Schema
const withdrawalSchema = new mongoose.Schema({
  userAddress: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  txHash: { type: String },
  chainId: { type: Number, required: true },
  tokenType: { type: String, default: 'USDT' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Deposit = mongoose.model('Deposit', depositSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

async function checkUserData() {
  try {
    console.log('🔍 Checking user data integrity...');
    console.log('MongoDB URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'data-integrity-check',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    
    console.log('✅ MongoDB connected successfully');
    
    const userAddress = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
    const normalizedAddress = userAddress.toLowerCase();
    
    console.log(`\n📊 Checking deposits for: ${normalizedAddress}`);
    console.log('=' .repeat(60));
    
    // Check deposits
    const deposits = await Deposit.find({ userAddress: normalizedAddress }).lean();
    console.log(`Found ${deposits.length} deposits`);
    
    if (deposits.length > 0) {
      deposits.forEach((deposit, index) => {
        console.log(`\n💰 Deposit ${index + 1}:`);
        console.log(`  ID: ${deposit._id}`);
        console.log(`  User Address: ${deposit.userAddress}`);
        console.log(`  Amount: ${deposit.amount} (type: ${typeof deposit.amount})`);
        console.log(`  Current Balance: ${deposit.currentBalance} (type: ${typeof deposit.currentBalance})`);
        console.log(`  Accumulated Yield: ${deposit.accumulatedYield} (type: ${typeof deposit.accumulatedYield})`);
        console.log(`  Daily Yield %: ${deposit.dailyYieldPercent} (type: ${typeof deposit.dailyYieldPercent})`);
        console.log(`  Chain ID: ${deposit.chainId} (type: ${typeof deposit.chainId})`);
        console.log(`  Token Type: ${deposit.tokenType} (type: ${typeof deposit.tokenType})`);
        console.log(`  TX Hash: ${deposit.txHash} (type: ${typeof deposit.txHash})`);
        console.log(`  Timestamp: ${deposit.timestamp} (type: ${typeof deposit.timestamp})`);
        console.log(`  Created At: ${deposit.createdAt} (type: ${typeof deposit.createdAt})`);
        console.log(`  Updated At: ${deposit.updatedAt} (type: ${typeof deposit.updatedAt})`);
        
        // Check for data integrity issues
        const issues = [];
        if (deposit.amount === null || deposit.amount === undefined) issues.push('❌ NULL amount');
        if (deposit.chainId === null || deposit.chainId === undefined) issues.push('❌ NULL chainId');
        if (deposit.txHash && deposit.txHash.length > 100) issues.push('❌ TX hash too long');
        if (deposit.timestamp && !(deposit.timestamp instanceof Date) && isNaN(new Date(deposit.timestamp))) issues.push('❌ Invalid timestamp');
        if (deposit.amount && (isNaN(deposit.amount) || deposit.amount < 0)) issues.push('❌ Invalid amount');
        if (deposit.currentBalance && (isNaN(deposit.currentBalance) || deposit.currentBalance < 0)) issues.push('❌ Invalid currentBalance');
        
        if (issues.length > 0) {
          console.log('  🚨 ISSUES FOUND:');
          issues.forEach(issue => console.log(`    ${issue}`));
        } else {
          console.log('  ✅ No data integrity issues found');
        }
      });
    }
    
    console.log(`\n📊 Checking withdrawals for: ${normalizedAddress}`);
    console.log('=' .repeat(60));
    
    // Check withdrawals
    const withdrawals = await Withdrawal.find({ userAddress: normalizedAddress }).lean();
    console.log(`Found ${withdrawals.length} withdrawals`);
    
    if (withdrawals.length > 0) {
      withdrawals.forEach((withdrawal, index) => {
        console.log(`\n💸 Withdrawal ${index + 1}:`);
        console.log(`  ID: ${withdrawal._id}`);
        console.log(`  User Address: ${withdrawal.userAddress}`);
        console.log(`  Amount: ${withdrawal.amount} (type: ${typeof withdrawal.amount})`);
        console.log(`  Chain ID: ${withdrawal.chainId} (type: ${typeof withdrawal.chainId})`);
        console.log(`  Token Type: ${withdrawal.tokenType} (type: ${typeof withdrawal.tokenType})`);
        console.log(`  TX Hash: ${withdrawal.txHash} (type: ${typeof withdrawal.txHash})`);
        console.log(`  Timestamp: ${withdrawal.timestamp} (type: ${typeof withdrawal.timestamp})`);
        console.log(`  Created At: ${withdrawal.createdAt} (type: ${typeof withdrawal.createdAt})`);
        console.log(`  Updated At: ${withdrawal.updatedAt} (type: ${typeof withdrawal.updatedAt})`);
        
        // Check for data integrity issues
        const issues = [];
        if (withdrawal.amount === null || withdrawal.amount === undefined) issues.push('❌ NULL amount');
        if (withdrawal.chainId === null || withdrawal.chainId === undefined) issues.push('❌ NULL chainId');
        if (withdrawal.txHash && withdrawal.txHash.length > 100) issues.push('❌ TX hash too long');
        if (withdrawal.timestamp && !(withdrawal.timestamp instanceof Date) && isNaN(new Date(withdrawal.timestamp))) issues.push('❌ Invalid timestamp');
        if (withdrawal.amount && (isNaN(withdrawal.amount) || withdrawal.amount < 0)) issues.push('❌ Invalid amount');
        
        if (issues.length > 0) {
          console.log('  🚨 ISSUES FOUND:');
          issues.forEach(issue => console.log(`    ${issue}`));
        } else {
          console.log('  ✅ No data integrity issues found');
        }
      });
    }
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`Total Deposits: ${deposits.length}`);
    console.log(`Total Withdrawals: ${withdrawals.length}`);
    
    const totalDeposited = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const netBalance = totalDeposited - totalWithdrawn;
    
    console.log(`Total Deposited: ${totalDeposited} USDT`);
    console.log(`Total Withdrawn: ${totalWithdrawn} USDT`);
    console.log(`Net Balance: ${netBalance} USDT`);
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

checkUserData();
