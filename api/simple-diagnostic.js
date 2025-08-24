export default async function handler(req, res) {
  try {
    // Simple diagnostic without any external dependencies
    const diagnostic = {
      success: true,
      timestamp: new Date().toISOString(),
      message: "Serverless function is working!",
      environment: process.env.NODE_ENV || 'unknown',
      envVars: {
        NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
        MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
        INFURA_API_KEY: process.env.INFURA_API_KEY ? 'SET' : 'NOT_SET',
        TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY ? 'SET' : 'NOT_SET'
      },
      criticalMissing: []
    };

    // Check for critical missing variables
    if (!process.env.MONGODB_URI) {
      diagnostic.criticalMissing.push('MONGODB_URI');
    }
    if (!process.env.INFURA_API_KEY) {
      diagnostic.criticalMissing.push('INFURA_API_KEY');
    }
    if (!process.env.TREASURY_PRIVATE_KEY) {
      diagnostic.criticalMissing.push('TREASURY_PRIVATE_KEY');
    }

    if (diagnostic.criticalMissing.length > 0) {
      diagnostic.status = 'MISSING_CRITICAL_VARS';
      diagnostic.error = `Missing critical environment variables: ${diagnostic.criticalMissing.join(', ')}`;
    }

    return res.status(200).json(diagnostic);
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    return res.status(500).json({
      success: false,
      error: 'Diagnostic failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
