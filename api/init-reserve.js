import mongoose from 'mongoose';

// Load environment variables
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

// Connect to MongoDB
const connectToMongoDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoDB] Reusing existing connection');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      retryWrites: true,
      w: 'majority',
      appName: 'vercel-init-reserve',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection error:', err.message);
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed. Only POST and GET requests are supported.' 
    });
  }

  try {
    console.log("[Init Reserve] Request received:", req.method);
    
    // Connect to MongoDB
    await connectToMongoDB();

    // Check existing reserve ledgers
    const existingLedgers = await ReserveLedger.find({}).lean();
    console.log(`[Init Reserve] Found ${existingLedgers.length} existing reserve ledgers`);

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

    const results = [];

    // Seed each chain
    for (const data of seedData) {
      try {
        // Check if ledger already exists
        const existingLedger = await ReserveLedger.findOne({ chainId: data.chainId });
        
        if (existingLedger) {
          console.log(`[Init Reserve] Reserve ledger for chain ${data.chainId} already exists`);
          results.push({
            chainId: data.chainId,
            status: 'exists',
            currentReserve: existingLedger.totalReserve,
            lastUpdated: existingLedger.lastUpdated
          });
        } else {
          // Create new ledger
          const newLedger = new ReserveLedger(data);
          await newLedger.save();
          console.log(`[Init Reserve] Created reserve ledger for chain ${data.chainId}: ${data.totalReserve} USDT`);
          results.push({
            chainId: data.chainId,
            status: 'created',
            totalReserve: data.totalReserve,
            notes: data.notes
          });
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`[Init Reserve] Reserve ledger for chain ${data.chainId} already exists (duplicate key error)`);
          results.push({
            chainId: data.chainId,
            status: 'exists',
            error: 'Duplicate key error'
          });
        } else {
          console.error(`[Init Reserve] Failed to seed chain ${data.chainId}:`, error.message);
          results.push({
            chainId: data.chainId,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    // Get final state
    const finalLedgers = await ReserveLedger.find({}).lean();
    
    console.log(`[Init Reserve] Final state: ${finalLedgers.length} reserve ledgers`);

    res.json({
      success: true,
      message: 'Reserve ledger initialization completed',
      results: results,
      finalState: {
        totalLedgers: finalLedgers.length,
        ledgers: finalLedgers.map(ledger => ({
          chainId: ledger.chainId,
          totalReserve: ledger.totalReserve,
          notes: ledger.notes,
          lastUpdated: ledger.lastUpdated
        }))
      }
    });

  } catch (error) {
    console.error("[Init Reserve] Error:", error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize reserve ledgers',
      details: error.message
    });
  }
}
