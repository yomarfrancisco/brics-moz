import express from 'express';
import cors from 'cors';

const app = express();

// CORS middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://buybrics.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// Test deposits endpoint
app.get('/api/deposits/:userAddress', async (req, res) => {
  const { userAddress } = req.params;
  console.log('Fetching deposits for:', userAddress);
  
  // Mock response
  res.json({
    success: true,
    deposits: [
      {
        userAddress: userAddress.toLowerCase(),
        amount: 1000,
        currentBalance: 1050,
        chainId: 8453,
        tokenType: 'USDT',
        txHash: '0x1234567890abcdef',
        timestamp: new Date(),
        accumulatedYield: 50,
        dailyYield: 5,
        dailyYieldPercent: 0.5
      }
    ],
    totalDeposited: 1000,
    totalAccumulatedYield: 50
  });
});

// Test POST deposits endpoint
app.post('/api/deposits', async (req, res) => {
  const { userAddress, amount, txHash, chainId } = req.body;
  console.log('Saving deposit:', { userAddress, amount, txHash, chainId });
  
  res.json({
    success: true,
    message: 'Deposit saved successfully',
    deposit: {
      id: 'test-deposit-id',
      userAddress: userAddress.toLowerCase(),
      amount,
      txHash,
      chainId,
      timestamp: new Date()
    }
  });
});

// Test withdrawals endpoint
app.post('/api/withdrawals', async (req, res) => {
  const { userAddress, amount } = req.body;
  console.log('Processing withdrawal:', { userAddress, amount });
  
  res.json({
    success: true,
    message: 'Withdrawal processed successfully',
    withdrawal: {
      id: 'test-withdrawal-id',
      userAddress: userAddress.toLowerCase(),
      amount,
      txHash: '0xabcdef1234567890',
      status: 'pending',
      timestamp: new Date()
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend API is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📡 API endpoints available:`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/deposits/:userAddress`);
  console.log(`   POST http://localhost:${PORT}/api/deposits`);
  console.log(`   POST http://localhost:${PORT}/api/withdrawals`);
});

export default app;
