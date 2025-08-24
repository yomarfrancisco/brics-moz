export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simple environment check without any external dependencies
    const envCheck = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      variables: {
        NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
        MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
        INFURA_API_KEY: process.env.INFURA_API_KEY ? 'SET' : 'NOT_SET',
        TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY ? 'SET' : 'NOT_SET',
        ALCHEMY_BASE_URL: process.env.ALCHEMY_BASE_URL ? 'SET' : 'NOT_SET',
        USDT_ETHEREUM_ADDRESS: process.env.USDT_ETHEREUM_ADDRESS ? 'SET' : 'NOT_SET',
        USDT_BASE_ADDRESS: process.env.USDT_BASE_ADDRESS ? 'SET' : 'NOT_SET',
        GOOGLE_SHEETS_CREDENTIALS: process.env.GOOGLE_SHEETS_CREDENTIALS ? 'SET' : 'NOT_SET',
        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID ? 'SET' : 'NOT_SET'
      },
      criticalMissing: [],
      status: 'OK'
    };

    // Check for critical missing variables
    if (!process.env.MONGODB_URI) {
      envCheck.criticalMissing.push('MONGODB_URI');
    }
    if (!process.env.INFURA_API_KEY) {
      envCheck.criticalMissing.push('INFURA_API_KEY');
    }
    if (!process.env.TREASURY_PRIVATE_KEY) {
      envCheck.criticalMissing.push('TREASURY_PRIVATE_KEY');
    }

    if (envCheck.criticalMissing.length > 0) {
      envCheck.status = 'MISSING_CRITICAL_VARS';
      envCheck.error = `Missing critical environment variables: ${envCheck.criticalMissing.join(', ')}`;
    }

    // Log the check results
    console.log('🔍 Environment Check Results:', {
      environment: envCheck.environment,
      criticalMissing: envCheck.criticalMissing,
      mongodbConfigured: !!process.env.MONGODB_URI,
      infuraConfigured: !!process.env.INFURA_API_KEY,
      treasuryConfigured: !!process.env.TREASURY_PRIVATE_KEY
    });

    return res.json(envCheck);

  } catch (error) {
    console.error('❌ Environment check failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Environment check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
