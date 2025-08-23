import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined. Please set it in environment variables.');
  process.exit(1);
}

// Reserve Ledger Schema
const reserveLedgerSchema = new mongoose.Schema({
  totalReserve: { type: Number, required: true, min: 0, default: 0 },
  chainId: { type: Number, required: true, index: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const ReserveLedger = mongoose.model('ReserveLedger', reserveLedgerSchema);

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'reserve-ledger-seeder',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// Seed data for both chains
const seedData = [
  {
    chainId: 1,
    totalReserve: 1000000, // 1M USDT for Ethereum
    lastUpdated: new Date(),
    notes: 'Initial reserve for Ethereum Mainnet'
  },
  {
    chainId: 8453,
    totalReserve: 1000000, // 1M USDT for Base
    lastUpdated: new Date(),
    notes: 'Initial reserve for Base Chain'
  }
];

async function seedReserveLedger() {
  try {
    console.log('🚀 Starting ReserveLedger seeding...');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Check existing reserve ledgers
    const existingLedgers = await ReserveLedger.find({}).lean();
    console.log(`📊 Found ${existingLedgers.length} existing reserve ledgers`);
    
    if (existingLedgers.length > 0) {
      console.log('📋 Existing ledgers:');
      existingLedgers.forEach(ledger => {
        console.log(`  - Chain ${ledger.chainId}: ${ledger.totalReserve} USDT`);
      });
    }
    
    // Seed each chain
    for (const data of seedData) {
      try {
        // Check if ledger already exists
        const existingLedger = await ReserveLedger.findOne({ chainId: data.chainId });
        
        if (existingLedger) {
          console.log(`⚠️  Reserve ledger for chain ${data.chainId} already exists`);
          console.log(`   Current reserve: ${existingLedger.totalReserve} USDT`);
          console.log(`   Last updated: ${existingLedger.lastUpdated}`);
        } else {
          // Create new ledger
          const newLedger = new ReserveLedger(data);
          await newLedger.save();
          console.log(`✅ Created reserve ledger for chain ${data.chainId}: ${data.totalReserve} USDT`);
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Reserve ledger for chain ${data.chainId} already exists (duplicate key error)`);
        } else {
          console.error(`❌ Failed to seed chain ${data.chainId}:`, error.message);
        }
      }
    }
    
    // Verify seeding
    console.log('\n🔍 Verifying seeded data...');
    const finalLedgers = await ReserveLedger.find({}).lean();
    
    if (finalLedgers.length === 0) {
      console.log('❌ No reserve ledgers found after seeding');
    } else {
      console.log(`✅ Successfully seeded ${finalLedgers.length} reserve ledgers:`);
      finalLedgers.forEach(ledger => {
        console.log(`  - Chain ${ledger.chainId}: ${ledger.totalReserve} USDT (${ledger.notes})`);
      });
    }
    
    console.log('\n🎉 ReserveLedger seeding completed!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the seeding
seedReserveLedger();
