#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Reserve Ledger Schema
const reserveLedgerSchema = new mongoose.Schema({
  totalReserve: { type: Number, required: true, min: 0, default: 0 },
  chainId: { type: Number, required: true, index: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Redemption Log Schema
const redemptionLogSchema = new mongoose.Schema({
  userAddress: { type: String, required: true, lowercase: true, index: true },
  redeemAmount: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  chainId: { type: Number, required: true, index: true },
  txHash: { type: String, required: true },
  reserveBefore: { type: Number, required: true },
  reserveAfter: { type: Number, required: true },
  testMode: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const ReserveLedger = mongoose.model('ReserveLedger', reserveLedgerSchema);
const RedemptionLog = mongoose.model('RedemptionLog', redemptionLogSchema);

async function connectToMongoDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined. Please set it in environment variables.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  console.log('📊 URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

  try {
    const connection = await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'reserve-status',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('🗄️  Database:', connection.connection.db.databaseName);
    
    return connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', {
      message: err.message,
      code: err.code,
      name: err.name,
    });
    process.exit(1);
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function printTable(data) {
  // Calculate column widths
  const chainNames = {
    1: 'Ethereum',
    8453: 'Base'
  };
  
  const headers = ['Chain', 'Reserve (USDT)', 'Last Updated', 'Notes'];
  const rows = data.map(item => [
    chainNames[item.chainId] || `Chain ${item.chainId}`,
    formatNumber(item.totalReserve),
    formatDate(item.lastUpdated),
    item.notes || '-'
  ]);
  
  // Calculate max widths
  const colWidths = headers.map((header, i) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map(row => row[i].length)
    );
    return Math.max(maxContentWidth, 10); // Minimum width of 10
  });
  
  // Print header
  const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ');
  console.log(headerRow);
  console.log('─'.repeat(headerRow.length));
  
  // Print data rows
  rows.forEach(row => {
    const dataRow = row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
    console.log(dataRow);
  });
}

async function printReserveStatus() {
  try {
    console.log('🏦 USDT Reserve Status Report');
    console.log('============================');
    console.log(`📅 Generated: ${formatDate(new Date())}`);
    console.log('');
    
    // Fetch all reserve ledgers
    const reserves = await ReserveLedger.find({}).lean().sort({ chainId: 1 });
    
    if (reserves.length === 0) {
      console.log('❌ No reserve ledgers found. Run the server to initialize reserves.');
      return;
    }
    
    // Print reserve table
    console.log('📊 Current Reserve Status:');
    console.log('');
    printTable(reserves);
    
    // Calculate totals
    const totalReserve = reserves.reduce((sum, reserve) => sum + reserve.totalReserve, 0);
    console.log('');
    console.log(`💰 Total Reserve Across All Chains: ${formatNumber(totalReserve)} USDT`);
    
    // Show recent redemptions
    console.log('');
    console.log('📋 Recent Redemptions (Last 10):');
    console.log('');
    
    const recentRedemptions = await RedemptionLog.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    
    if (recentRedemptions.length === 0) {
      console.log('ℹ️  No redemptions found.');
    } else {
      const redemptionHeaders = ['Date', 'User', 'Amount', 'Chain', 'Reserve Before', 'Reserve After', 'Test Mode'];
      const redemptionRows = recentRedemptions.map(redemption => [
        formatDate(redemption.timestamp),
        `${redemption.userAddress.slice(0, 8)}...${redemption.userAddress.slice(-6)}`,
        formatNumber(redemption.redeemAmount),
        redemption.chainId === 1 ? 'Ethereum' : 'Base',
        formatNumber(redemption.reserveBefore),
        formatNumber(redemption.reserveAfter),
        redemption.testMode ? 'Yes' : 'No'
      ]);
      
      // Calculate redemption table widths
      const redemptionColWidths = redemptionHeaders.map((header, i) => {
        const maxContentWidth = Math.max(
          header.length,
          ...redemptionRows.map(row => row[i].length)
        );
        return Math.max(maxContentWidth, 8);
      });
      
      // Print redemption header
      const redemptionHeaderRow = redemptionHeaders.map((header, i) => header.padEnd(redemptionColWidths[i])).join(' | ');
      console.log(redemptionHeaderRow);
      console.log('─'.repeat(redemptionHeaderRow.length));
      
      // Print redemption data
      redemptionRows.forEach(row => {
        const dataRow = row.map((cell, i) => cell.padEnd(redemptionColWidths[i])).join(' | ');
        console.log(dataRow);
      });
    }
    
    // Show statistics
    console.log('');
    console.log('📈 Statistics:');
    console.log('');
    
    const totalRedemptions = await RedemptionLog.countDocuments({});
    const totalRedemptionAmount = await RedemptionLog.aggregate([
      { $group: { _id: null, total: { $sum: '$redeemAmount' } } }
    ]);
    
    const testRedemptions = await RedemptionLog.countDocuments({ testMode: true });
    const realRedemptions = totalRedemptions - testRedemptions;
    
    console.log(`   Total Redemptions: ${totalRedemptions}`);
    console.log(`   Real Redemptions: ${realRedemptions}`);
    console.log(`   Test Redemptions: ${testRedemptions}`);
    console.log(`   Total Amount Redeemed: ${formatNumber(totalRedemptionAmount[0]?.total || 0)} USDT`);
    
    // Chain-specific stats
    console.log('');
    console.log('🔗 Per-Chain Statistics:');
    console.log('');
    
    for (const reserve of reserves) {
      const chainRedemptions = await RedemptionLog.countDocuments({ chainId: reserve.chainId });
      const chainAmount = await RedemptionLog.aggregate([
        { $match: { chainId: reserve.chainId } },
        { $group: { _id: null, total: { $sum: '$redeemAmount' } } }
      ]);
      
      const chainName = reserve.chainId === 1 ? 'Ethereum' : 'Base';
      console.log(`   ${chainName} (Chain ${reserve.chainId}):`);
      console.log(`     Current Reserve: ${formatNumber(reserve.totalReserve)} USDT`);
      console.log(`     Total Redemptions: ${chainRedemptions}`);
      console.log(`     Total Amount Redeemed: ${formatNumber(chainAmount[0]?.total || 0)} USDT`);
      console.log(`     Last Updated: ${formatDate(reserve.lastUpdated)}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error generating reserve status:', error);
  }
}

async function main() {
  console.log('🏦 Starting Reserve Status Report');
  console.log('================================');
  
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Print reserve status
    await printReserveStatus();
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
