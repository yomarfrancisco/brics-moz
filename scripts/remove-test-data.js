// scripts/remove-test-data.js
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

async function removeTestData() {
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
      userAddress: { type: String, required: true, lowercase: true },
      amount: { type: Number, required: true, min: 0 },
      txHash: { type: String, required: true, unique: true },
      chainId: { type: Number, required: true },
      isTestData: { type: Boolean, default: false },
    });

    const withdrawalSchema = new mongoose.Schema({
      userAddress: { type: String, required: true, lowercase: true },
      amount: { type: Number, required: true, min: 0 },
      txHash: { type: String, required: true, unique: true },
      chainId: { type: Number, required: true },
      isTestData: { type: Boolean, default: false },
    });

    const Deposit = mongoose.model('Deposit', depositSchema);
    const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

    // Remove test data
    const deletedDeposits = await Deposit.deleteMany({ isTestData: true });
    const deletedWithdrawals = await Withdrawal.deleteMany({ isTestData: true });
    console.log(`Deleted ${deletedDeposits.deletedCount} test deposits`);
    console.log(`Deleted ${deletedWithdrawals.deletedCount} test withdrawals`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error removing test data:', error);
    process.exit(1);
  }
}

removeTestData();