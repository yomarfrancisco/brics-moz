import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step 1: Confirm Vercel ENV is properly loaded
    console.log("🔍 Environment Check:");
    console.log("NODE_ENV =", process.env.NODE_ENV);
    console.log("MONGODB_URI configured =", !!process.env.MONGODB_URI);
    console.log("INFURA_API_KEY configured =", !!process.env.INFURA_API_KEY);
    console.log("TREASURY_PRIVATE_KEY configured =", !!process.env.TREASURY_PRIVATE_KEY);
    
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({
        success: false,
        error: 'MONGODB_URI environment variable is not configured',
        environment: process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Connect to MongoDB using MongoClient
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      console.log("✅ Connected to MongoDB Atlas Cluster");

      const db = client.db("brics-production");
      const testCollection = db.collection("liveTest");

      // Step 3: Write Test
      const insertResult = await testCollection.insertOne({
        timestamp: new Date(),
        env: process.env.NODE_ENV || "unknown",
        origin: "Theo Mongo Test",
        status: "INSERTED",
        testId: Math.random().toString(36).substring(7)
      });
      console.log("📝 Insert Result:", insertResult.insertedId);

      // Step 4: Read Test
      const found = await testCollection.findOne({ _id: insertResult.insertedId });
      console.log("🔍 Read Result:", found);

      // Step 5: Cleanup
      const deleteResult = await testCollection.deleteOne({ _id: insertResult.insertedId });
      console.log("🧹 Cleanup Result:", deleteResult);

      // Step 6: Test existing collections
      const collections = await db.listCollections().toArray();
      console.log("📋 Available collections:", collections.map(c => c.name));

      // Step 7: Test deposits collection if it exists
      let depositsCount = 0;
      let withdrawalsCount = 0;
      
      if (collections.some(c => c.name === 'deposits')) {
        const depositsCollection = db.collection("deposits");
        depositsCount = await depositsCollection.countDocuments();
        console.log("💰 Deposits count:", depositsCount);
      }
      
      if (collections.some(c => c.name === 'withdrawals')) {
        const withdrawalsCollection = db.collection("withdrawals");
        withdrawalsCount = await withdrawalsCollection.countDocuments();
        console.log("💸 Withdrawals count:", withdrawalsCount);
      }

      await client.close();

      return res.json({
        success: true,
        message: "✅ MongoDB Live Test Passed",
        environment: process.env.NODE_ENV || "unknown",
        timestamp: new Date().toISOString(),
        testResults: {
          connection: "✅ Connected",
          write: "✅ Inserted",
          read: "✅ Retrieved",
          cleanup: "✅ Deleted",
          collections: collections.map(c => c.name),
          depositsCount,
          withdrawalsCount
        },
        environmentCheck: {
          mongodbConfigured: !!process.env.MONGODB_URI,
          infuraConfigured: !!process.env.INFURA_API_KEY,
          treasuryConfigured: !!process.env.TREASURY_PRIVATE_KEY,
          nodeEnv: process.env.NODE_ENV || "unknown"
        }
      });

    } catch (mongoError) {
      console.error("❌ MongoDB Test Failed:", mongoError);
      await client.close();
      
      return res.status(500).json({
        success: false,
        error: 'MongoDB connection test failed',
        details: mongoError.message,
        environment: process.env.NODE_ENV || "unknown",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("❌ General test error:", error);
    return res.status(500).json({
      success: false,
      error: 'General test error',
      details: error.message,
      environment: process.env.NODE_ENV || "unknown",
      timestamp: new Date().toISOString()
    });
  }
}
