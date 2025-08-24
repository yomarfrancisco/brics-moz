import mongoose from 'mongoose';

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

const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', depositSchema);
const Withdrawal = mongoose.models.Withdrawal || mongoose.model('Withdrawal', withdrawalSchema);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'MONGODB_URI not configured' });
    }

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'data-integrity-check',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });

    const userAddress = '0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1';
    const normalizedAddress = userAddress.toLowerCase();

    // Check deposits
    const deposits = await Deposit.find({ userAddress: normalizedAddress }).lean();
    
    // Check withdrawals
    const withdrawals = await Withdrawal.find({ userAddress: normalizedAddress }).lean();

    // Analyze data integrity
    const depositIssues = [];
    const withdrawalIssues = [];

    deposits.forEach((deposit, index) => {
      const issues = [];
      if (deposit.amount === null || deposit.amount === undefined) issues.push('NULL amount');
      if (deposit.chainId === null || deposit.chainId === undefined) issues.push('NULL chainId');
      if (deposit.txHash && deposit.txHash.length > 100) issues.push('TX hash too long');
      if (deposit.timestamp && isNaN(new Date(deposit.timestamp))) issues.push('Invalid timestamp');
      if (deposit.amount && (isNaN(deposit.amount) || deposit.amount < 0)) issues.push('Invalid amount');
      if (deposit.currentBalance && (isNaN(deposit.currentBalance) || deposit.currentBalance < 0)) issues.push('Invalid currentBalance');
      
      if (issues.length > 0) {
        depositIssues.push({
          index: index + 1,
          id: deposit._id,
          issues: issues
        });
      }
    });

    withdrawals.forEach((withdrawal, index) => {
      const issues = [];
      if (withdrawal.amount === null || withdrawal.amount === undefined) issues.push('NULL amount');
      if (withdrawal.chainId === null || withdrawal.chainId === undefined) issues.push('NULL chainId');
      if (withdrawal.txHash && withdrawal.txHash.length > 100) issues.push('TX hash too long');
      if (withdrawal.timestamp && isNaN(new Date(withdrawal.timestamp))) issues.push('Invalid timestamp');
      if (withdrawal.amount && (isNaN(withdrawal.amount) || withdrawal.amount < 0)) issues.push('Invalid amount');
      
      if (issues.length > 0) {
        withdrawalIssues.push({
          index: index + 1,
          id: withdrawal._id,
          issues: issues
        });
      }
    });

    // Calculate totals
    const totalDeposited = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const netBalance = totalDeposited - totalWithdrawn;

    // Return detailed analysis
    res.status(200).json({
      success: true,
      userAddress: normalizedAddress,
      summary: {
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        totalDeposited: totalDeposited,
        totalWithdrawn: totalWithdrawn,
        netBalance: netBalance
      },
      deposits: deposits.map(d => ({
        id: d._id,
        amount: d.amount,
        currentBalance: d.currentBalance,
        accumulatedYield: d.accumulatedYield,
        chainId: d.chainId,
        txHash: d.txHash,
        timestamp: d.timestamp,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      })),
      withdrawals: withdrawals.map(w => ({
        id: w._id,
        amount: w.amount,
        chainId: w.chainId,
        txHash: w.txHash,
        timestamp: w.timestamp,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      })),
      issues: {
        deposits: depositIssues,
        withdrawals: withdrawalIssues
      }
    });

  } catch (error) {
    console.error('Data integrity check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await mongoose.connection.close();
  }
}
