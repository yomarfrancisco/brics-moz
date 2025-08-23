export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log("[Test Redeem] Request received:", req.method, req.body);
    
    // Simple mock response without any database operations
    return res.status(200).json({
      success: true,
      status: 'success',
      newBalance: 0,
      txHash: "0x" + Math.random().toString(16).substr(2, 64),
      redeemedAmount: 1,
      userAddress: "0xDD7FC80cafb2f055fb6a519d4043c29EA76a7ce1",
      chainId: 1,
      tokenType: "USDT",
      reserveBefore: 1000000,
      reserveAfter: 999999,
      testMode: true,
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      gasUsed: "65000",
      onChainSuccess: true,
      dryRun: false,
      transferError: null,
      note: "Test endpoint - no database operations"
    });

  } catch (error) {
    console.error("[Test Redeem] Error:", error);
    res.status(500).json({ 
      success: false, 
      error: 'Test endpoint error',
      details: error.message
    });
  }
}
