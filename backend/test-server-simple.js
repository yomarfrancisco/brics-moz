import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'https://buybrics.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

// Mock data storage
let deposits = [];
let withdrawals = [];
let reserveLedger = {
  1: { totalReserve: 100000 },
  8453: { totalReserve: 100000 }
};

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Test server is running', timestamp: new Date().toISOString() });
});

// Mock deposits endpoint
app.get('/api/deposits/:userAddress', (req, res) => {
  const userAddress = req.params.userAddress.toLowerCase();
  const userDeposits = deposits.filter(d => d.userAddress === userAddress);
  const totalDeposited = userDeposits.reduce((sum, d) => sum + d.amount, 0);
  
  res.json({
    success: true,
    deposits: userDeposits,
    totalDeposited: totalDeposited
  });
});

// Mock create deposit endpoint
app.post('/api/deposits', (req, res) => {
  const { userAddress, amount, txHash, chainId } = req.body;
  
  const deposit = {
    userAddress: userAddress.toLowerCase(),
    amount: parseFloat(amount),
    currentBalance: parseFloat(amount),
    txHash: txHash,
    chainId: parseInt(chainId),
    tokenType: 'USDT',
    timestamp: new Date(),
    accumulatedYield: 0,
    dailyYield: 0,
    dailyYieldPercent: 0.5
  };
  
  deposits.push(deposit);
  
  res.json({
    success: true,
    deposit: deposit
  });
});

// Mock redeem endpoint
app.post('/api/redeem', (req, res) => {
  const { userAddress, chainId, redeemAmount, tokenType, testMode = false } = req.body;
  
  const normalizedUserAddress = userAddress.toLowerCase();
  const parsedChainId = parseInt(chainId);
  const parsedRedeemAmount = parseFloat(redeemAmount);
  
  // Find user deposits
  const userDeposits = deposits.filter(d => 
    d.userAddress === normalizedUserAddress && 
    d.chainId === parsedChainId
  );
  
  if (userDeposits.length === 0) {
    return res.status(404).json({ 
      success: false, 
      error: 'No deposits found for this user address and chain' 
    });
  }
  
  // Calculate total balance
  const totalBalance = userDeposits.reduce((sum, d) => sum + d.currentBalance, 0);
  
  if (parsedRedeemAmount > totalBalance) {
    return res.status(400).json({
      success: false,
      error: 'Insufficient balance for redemption',
      details: {
        requestedAmount: parsedRedeemAmount,
        availableBalance: totalBalance,
        shortfall: parsedRedeemAmount - totalBalance
      }
    });
  }
  
  // Check reserve (skip if testMode)
  let reserveBefore = reserveLedger[parsedChainId]?.totalReserve || 0;
  let reserveAfter = reserveBefore;
  
  if (!testMode) {
    if (reserveBefore < parsedRedeemAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient reserve liquidity',
        details: {
          requestedAmount: parsedRedeemAmount,
          availableReserve: reserveBefore,
          shortfall: parsedRedeemAmount - reserveBefore
        }
      });
    }
    
    reserveAfter = reserveBefore - parsedRedeemAmount;
    reserveLedger[parsedChainId].totalReserve = reserveAfter;
  }
  
  // Update deposits proportionally
  let remainingRedeemAmount = parsedRedeemAmount;
  let newTotalBalance = 0;
  
  for (const deposit of userDeposits) {
    if (remainingRedeemAmount <= 0) break;
    
    const currentBalance = deposit.currentBalance;
    if (currentBalance <= 0) continue;
    
    const redeemFromThisDeposit = Math.min(remainingRedeemAmount, currentBalance);
    const newBalance = currentBalance - redeemFromThisDeposit;
    remainingRedeemAmount -= redeemFromThisDeposit;
    
    deposit.currentBalance = newBalance;
    deposit.lastRedeemedAt = new Date();
    deposit.lastRedeemedAmount = redeemFromThisDeposit;
    deposit.lastRedeemedTxHash = `0xmock${Date.now()}`;
    
    newTotalBalance += newBalance;
  }
  
  // Generate mock transaction hash
  const mockTxHash = `0xmock${Date.now()}${Math.random().toString(36).slice(2)}`;
  
  // Log withdrawal
  const withdrawal = {
    userAddress: normalizedUserAddress,
    redeemAmount: parsedRedeemAmount,
    timestamp: new Date(),
    chainId: parsedChainId,
    txHash: mockTxHash,
    reserveBefore: reserveBefore,
    reserveAfter: reserveAfter,
    testMode: testMode,
    blockNumber: testMode ? null : Math.floor(Math.random() * 1000000) + 1000000,
    gasUsed: testMode ? null : (Math.floor(Math.random() * 50000) + 30000).toString(),
    onChainSuccess: true,
    transferError: null,
    dryRun: testMode
  };
  
  withdrawals.push(withdrawal);
  
  console.log(`✅ Mock redemption completed: ${parsedRedeemAmount} USDT for ${normalizedUserAddress} on chain ${parsedChainId}`);
  console.log(`   TX Hash: ${mockTxHash}`);
  console.log(`   New Balance: ${newTotalBalance} USDT`);
  console.log(`   Reserve: ${reserveBefore} → ${reserveAfter} USDT`);
  
  res.json({
    success: true,
    status: 'success',
    newBalance: newTotalBalance,
    txHash: mockTxHash,
    redeemedAmount: parsedRedeemAmount,
    userAddress: normalizedUserAddress,
    chainId: parsedChainId,
    tokenType: tokenType,
    reserveBefore: reserveBefore,
    reserveAfter: reserveAfter,
    testMode: testMode,
    blockNumber: withdrawal.blockNumber,
    gasUsed: withdrawal.gasUsed,
    onChainSuccess: withdrawal.onChainSuccess,
    dryRun: withdrawal.dryRun,
    transferError: withdrawal.transferError
  });
});

// Mock reserve status endpoint
app.get('/api/reserve-status', (req, res) => {
  res.json({
    success: true,
    totalReserve: Object.values(reserveLedger).reduce((sum, r) => sum + r.totalReserve, 0),
    chainReserves: reserveLedger
  });
});

// Start server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/deposits/:userAddress`);
  console.log(`   POST /api/deposits`);
  console.log(`   POST /api/redeem`);
  console.log(`   GET  /api/reserve-status`);
  console.log(`\n🎯 Ready for frontend testing!`);
});
