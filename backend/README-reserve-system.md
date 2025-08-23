# USDT Reserve Ledger System

A transparent internal reserve system that simulates stablecoin backing for USDT redemptions, making the redemption process more credible before going on-chain.

## 🏦 Overview

The reserve system consists of two main components:
1. **Reserve Ledger** (`usdt-reserve.ledger` collection) - Tracks available USDT reserves per chain
2. **Redemption Logs** (`usdt-reserve.redemptions` collection) - Audit trail of all redemptions

## 📊 Database Schema

### Reserve Ledger Schema
```javascript
{
  totalReserve: Number,        // USDT balance available
  chainId: Number,            // 1 = Ethereum, 8453 = Base
  lastUpdated: Date,          // Last modification timestamp
  notes: String,              // Optional notes
  createdAt: Date,            // Creation timestamp
  updatedAt: Date             // Last update timestamp
}
```

### Redemption Log Schema
```javascript
{
  userAddress: String,        // User's wallet address
  redeemAmount: Number,       // Amount redeemed
  timestamp: Date,            // Redemption timestamp
  chainId: Number,            // Chain where redemption occurred
  txHash: String,             // Transaction hash
  reserveBefore: Number,      // Reserve before redemption
  reserveAfter: Number,       // Reserve after redemption
  testMode: Boolean,          // Whether this was a test redemption
  createdAt: Date,            // Creation timestamp
  updatedAt: Date             // Last update timestamp
}
```

## 🚀 Initialization

### Automatic Initialization
The reserve system automatically initializes when the server starts:

```javascript
// Initial reserves per chain
{
  "totalReserve": 100000,     // 100k USDT
  "chainId": 1,               // Ethereum
  "notes": "Initial reserve for chain 1"
}

{
  "totalReserve": 100000,     // 100k USDT
  "chainId": 8453,            // Base
  "notes": "Initial reserve for chain 8453"
}
```

### Manual Initialization
```bash
# Start the server to auto-initialize reserves
node server.js
```

## 🔄 Updated Redeem Endpoint

The `/api/redeem` endpoint now includes reserve validation:

### Request Body
```json
{
  "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
  "chainId": 8453,
  "redeemAmount": 10,
  "tokenType": "USDT",
  "testMode": false
}
```

### Response (Success)
```json
{
  "success": true,
  "status": "success",
  "newBalance": 20.5,
  "txHash": "0x1234567890abcdef...",
  "redeemedAmount": 10,
  "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
  "chainId": 8453,
  "tokenType": "USDT",
  "reserveBefore": 100000,
  "reserveAfter": 99990,
  "testMode": false
}
```

### Response (Insufficient Reserve)
```json
{
  "success": false,
  "error": "Insufficient reserve liquidity",
  "details": {
    "requestedAmount": 200000,
    "availableReserve": 100000,
    "shortfall": 100000
  }
}
```

## 🔒 Safety Features

### 1. Transaction Safety
- **MongoDB Transactions**: All operations use database transactions
- **Atomic Updates**: Reserve deduction and deposit updates happen atomically
- **Rollback on Error**: Failed operations automatically rollback

### 2. Test Mode Protection
- **testMode Flag**: When `true`, skips reserve deduction
- **Test Data Isolation**: Test redemptions don't affect real reserves
- **Audit Trail**: All redemptions are logged regardless of test mode

### 3. Concurrency Protection
- **Session-based Operations**: Prevents race conditions
- **Optimistic Locking**: Uses MongoDB's built-in concurrency control
- **Transaction Isolation**: Ensures data consistency

## 📋 CLI Tools

### Reserve Status Report
```bash
node printReserveStatus.js
```

**Output:**
```
🏦 USDT Reserve Status Report
============================
📅 Generated: Dec 22, 2024, 12:34:56 PM

📊 Current Reserve Status:

Chain        | Reserve (USDT) | Last Updated           | Notes
Ethereum     | 100,000.00     | Dec 22, 2024, 12:30:00 | Initial reserve for chain 1
Base         | 99,990.00      | Dec 22, 2024, 12:35:00 | Redemption: -10 USDT

💰 Total Reserve Across All Chains: 199,990.00 USDT

📋 Recent Redemptions (Last 10):

Date                    | User        | Amount  | Chain   | Reserve Before | Reserve After | Test Mode
Dec 22, 2024, 12:35:00 | 0x1234...5678 | 10.00   | Base    | 100,000.00     | 99,990.00     | No

📈 Statistics:

   Total Redemptions: 1
   Real Redemptions: 1
   Test Redemptions: 0
   Total Amount Redeemed: 10.00 USDT

🔗 Per-Chain Statistics:

   Ethereum (Chain 1):
     Current Reserve: 100,000.00 USDT
     Total Redemptions: 0
     Total Amount Redeemed: 0.00 USDT
     Last Updated: Dec 22, 2024, 12:30:00

   Base (Chain 8453):
     Current Reserve: 99,990.00 USDT
     Total Redemptions: 1
     Total Amount Redeemed: 10.00 USDT
     Last Updated: Dec 22, 2024, 12:35:00
```

## 🧪 Testing

### Test Reserve System
```bash
node testReserveSystem.js
```

**Test Scenarios:**
1. **Test Mode Redemption**: Skips reserve deduction
2. **Real Redemption**: Deducts from reserve
3. **Large Redemption**: Rejects if insufficient reserve
4. **Audit Trail**: Verifies redemption logs

### Manual Testing
```bash
# Test mode redemption (skips reserve)
curl -X POST http://localhost:4000/api/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    "chainId": 8453,
    "redeemAmount": 10,
    "tokenType": "USDT",
    "testMode": true
  }'

# Real redemption (deducts from reserve)
curl -X POST http://localhost:4000/api/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    "chainId": 8453,
    "redeemAmount": 10,
    "tokenType": "USDT",
    "testMode": false
  }'
```

## 🔧 Configuration

### Environment Variables
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 4000)

### Initial Reserve Amounts
- **Ethereum (Chain 1)**: 100,000 USDT
- **Base (Chain 8453)**: 100,000 USDT

## 📈 Monitoring

### Key Metrics
- **Total Reserve**: Sum across all chains
- **Redemption Volume**: Total amount redeemed
- **Reserve Utilization**: Percentage of reserve used
- **Chain Distribution**: Reserve allocation per chain

### Alerts
- **Low Reserve**: When reserve falls below threshold
- **High Redemption Rate**: Unusual redemption activity
- **Failed Transactions**: Redemption failures

## 🚀 Future Enhancements

### Planned Features
1. **Dynamic Reserve Management**: Auto-rebalancing reserves
2. **Multi-Token Support**: Support for other stablecoins
3. **Reserve Analytics**: Advanced reporting and analytics
4. **Automated Replenishment**: Auto-refill reserves from treasury
5. **Real-time Monitoring**: WebSocket updates for reserve changes

### Integration Points
- **Treasury System**: For reserve replenishment
- **Analytics Dashboard**: For reserve monitoring
- **Alert System**: For reserve notifications
- **Audit System**: For compliance reporting

## 🔍 Troubleshooting

### Common Issues

#### Reserve Not Found
```
Error: Reserve ledger not found for this chain
```
**Solution**: Run server to initialize reserves

#### Insufficient Reserve
```
Error: Insufficient reserve liquidity
```
**Solution**: Check reserve status and replenish if needed

#### Transaction Failures
```
Error: Failed to process redemption
```
**Solution**: Check MongoDB connection and retry

### Debug Commands
```bash
# Check reserve status
node printReserveStatus.js

# Test reserve system
node testReserveSystem.js

# Check MongoDB connection
node -e "console.log(process.env.MONGODB_URI)"
```

## 📝 Usage Examples

### Frontend Integration
```javascript
const redeemWithReserve = async (userAddress, amount, testMode = false) => {
  const response = await fetch('/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      chainId: 8453,
      redeemAmount: amount,
      tokenType: 'USDT',
      testMode
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`Redeemed ${result.redeemedAmount} USDT`);
    console.log(`Reserve: ${result.reserveBefore} → ${result.reserveAfter} USDT`);
    console.log(`Transaction: ${result.txHash}`);
  }
  
  return result;
};
```

### Error Handling
```javascript
try {
  const result = await redeemWithReserve(address, amount, false);
  
  if (result.success) {
    // Handle success
  } else if (result.error === 'Insufficient reserve liquidity') {
    // Handle insufficient reserve
    console.log(`Reserve shortfall: ${result.details.shortfall} USDT`);
  } else {
    // Handle other errors
    console.error('Redemption failed:', result.error);
  }
} catch (error) {
  console.error('Network error:', error);
}
```
