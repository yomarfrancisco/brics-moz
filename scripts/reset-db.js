// scripts/reset-db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined. Please ensure .env file contains MONGODB_URI.');
  process.exit(1);
}

async function resetDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'ethers-cluster',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    console.log('Connected to MongoDB');

    // Define schemas
    const depositSchema = new mongoose.Schema({
      userAddress: { type: String, required: true, lowercase: true, index: true },
      amount: { type: Number, required: true, min: 0 },
      txHash: { type: String, required: true, unique: true },
      chainId: { type: Number, required: true, index: true },
      timestamp: { type: Date, default: Date.now },
      tokenType: { type: String, enum: ['USDT', 'MockUSDT'], default: 'USDT' },
      maturityDate: { type: Date, default: null, index: true },
      currentBalance: { type: Number, required: true, min: 0, default: 0 },
      accumulatedYield: { type: Number, required: true, min: 0, default: 0 },
      paymentStatus: { type: String, enum: ['Accumulating', 'Paid'], default: 'Accumulating' },
      isTestData: { type: Boolean, default: false }, // Flag for test data
    }, { timestamps: true });

    const withdrawalSchema = new mongoose.Schema({
      userAddress: { type: String, required: true, lowercase: true, index: true },
      amount: { type: Number, required: true, min: 0 },
      txHash: { type: String, required: true, unique: true },
      chainId: { type: Number, required: true, index: true },
      timestamp: { type: Date, default: Date.now },
      status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
      isTestData: { type: Boolean, default: false }, // Flag for test data
    }, { timestamps: true });

    const Deposit = mongoose.model('Deposit', depositSchema);
    const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

    // Clear existing data
    await Deposit.deleteMany({});
    await Withdrawal.deleteMany({});
    console.log('Cleared existing deposits and withdrawals');

    // Insert test data (Mainnet, small amounts)
    const testDeposits = [
      {
        userAddress: '0x1234abcd1234abcd1234abcd1234abcd1234abcd',
        amount: 40,
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        chainId: 1, // Mainnet
        timestamp: new Date('2025-05-09'),
        tokenType: 'USDT',
        maturityDate: new Date('2025-06-08'),
        currentBalance: 40.20,
        accumulatedYield: 0.20,
        paymentStatus: 'Accumulating',
        isTestData: true,
      },
      {
        userAddress: '0x5678efgh5678efgh5678efgh5678efgh5678efgh',
        amount: 30,
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        chainId: 1, // Mainnet
        timestamp: new Date('2025-05-08'),
        tokenType: 'USDT',
        maturityDate: new Date('2025-06-07'),
        currentBalance: 30.15,
        accumulatedYield: 0.15,
        paymentStatus: 'Accumulating',
        isTestData: true,
      },
    ];

    const testWithdrawals = [
      {
        userAddress: '0x5678efgh5678efgh5678efgh5678efgh5678efgh',
        amount: 30,
        txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        chainId: 1, // Mainnet
        timestamp: new Date('2025-05-09'),
        status: 'Pending',
        isTestData: true,
      },
    ];

    await Deposit.insertMany(testDeposits);
    await Withdrawal.insertMany(testWithdrawals);
    console.log('Inserted test data');

    // Verify indexes
    await Deposit.collection.createIndex({ userAddress: 1 });
    await Deposit.collection.createIndex({ chainId: 1 });
    await Deposit.collection.createIndex({ maturityDate: 1 });
    await Deposit.collection.createIndex({ userAddress: 1, chainId: 1 });
    await Withdrawal.collection.createIndex({ userAddress: 1 });
    await Withdrawal.collection.createIndex({ chainId: 1 });
    await Withdrawal.collection.createIndex({ userAddress: 1, chainId: 1 });
    console.log('Indexes created');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();