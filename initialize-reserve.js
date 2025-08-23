import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// Reserve Ledger Schema
const reserveLedgerSchema = new mongoose.Schema({
  totalReserve: { type: Number, required: true, min: 0, default: 0 },
  chainId: { type: Number, required: true, index: true, unique: true },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

const ReserveLedger = mongoose.models.ReserveLedger || mongoose.model('ReserveLedger', reserveLedgerSchema);

async function initializeReserveLedger() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ Connected to MongoDB');

    // Initialize reserves for both Ethereum and Base
    const reserves = [
      {
        chainId: 1,
        totalReserve: 1000000, // 1M USDT reserve for Ethereum
        notes: 'Initial reserve for Ethereum Mainnet - Production Ready'
      },
      {
        chainId: 8453,
        totalReserve: 1000000, // 1M USDT reserve for Base
        notes: 'Initial reserve for Base - Production Ready'
      }
    ];

    console.log('\n📦 Initializing Reserve Ledger...');
    
    for (const reserveData of reserves) {
      try {
        // Check if reserve already exists
        const existingReserve = await ReserveLedger.findOne({ chainId: reserveData.chainId });
        
        if (existingReserve) {
          console.log(`⚠️  Reserve for chain ${reserveData.chainId} already exists:`);
          console.log(`   Current Reserve: ${existingReserve.totalReserve} USDT`);
          console.log(`   Last Updated: ${existingReserve.lastUpdated}`);
          console.log(`   Notes: ${existingReserve.notes}`);
        } else {
          // Create new reserve
          const newReserve = new ReserveLedger({
            chainId: reserveData.chainId,
            totalReserve: reserveData.totalReserve,
            lastUpdated: new Date(),
            notes: reserveData.notes
          });
          
          await newReserve.save();
          console.log(`✅ Created reserve for chain ${reserveData.chainId}:`);
          console.log(`   Initial Reserve: ${reserveData.totalReserve} USDT`);
          console.log(`   Notes: ${reserveData.notes}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize reserve for chain ${reserveData.chainId}:`, error.message);
      }
    }

    // Display current status
    console.log('\n📊 CURRENT RESERVE STATUS:');
    console.log('─'.repeat(60));
    
    const allReserves = await ReserveLedger.find({}).sort({ chainId: 1 });
    
    for (const reserve of allReserves) {
      const chainName = reserve.chainId === 1 ? 'Ethereum' : reserve.chainId === 8453 ? 'Base' : `Chain ${reserve.chainId}`;
      console.log(`${chainName} (${reserve.chainId}):`);
      console.log(`   Reserve: ${reserve.totalReserve.toLocaleString()} USDT`);
      console.log(`   Updated: ${reserve.lastUpdated.toISOString()}`);
      console.log(`   Notes: ${reserve.notes}`);
      console.log('');
    }

    console.log('🎉 Reserve initialization completed!');
    console.log('📋 Backend is now ready for real redemptions.');
    
  } catch (error) {
    console.error('❌ Reserve initialization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Execute the initialization
initializeReserveLedger();
