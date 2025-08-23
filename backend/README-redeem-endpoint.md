# Redeem Endpoint Documentation

A secure `POST /api/redeem` route that allows users to redeem their USDT balance from the MongoDB deposits collection with **on-chain USDT payouts**.

## 🎯 Core Functionality

### Input Validation
- **userAddress**: Ethereum-like address (required)
- **chainId**: Supported chains 1 (Ethereum) or 8453 (Base) (required)
- **redeemAmount**: Amount to redeem in USDT (required, must be > 0)
- **tokenType**: Token type (required, defaults to "USDT")

### Security Features
- ✅ **Input Sanitization**: All inputs are validated and sanitized
- ✅ **Test Data Protection**: Excludes deposits with `isTestData: true`
- ✅ **Balance Validation**: Ensures `redeemAmount <= currentBalance`
- ✅ **Reserve Validation**: Ensures sufficient reserve liquidity
- ✅ **Chain Validation**: Only supports Ethereum (1) and Base (8453)
- ✅ **On-Chain Transfer**: Real USDT transfers via ethers.js
- ✅ **Transaction Safety**: MongoDB transactions with rollback on failure
- ✅ **Error Handling**: Clear error messages for all failure cases

## 📡 API Endpoint

### POST `/api/redeem`

**Request Body:**
```json
{
  "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
  "chainId": 8453,
  "redeemAmount": 10,
  "tokenType": "USDT",
  "testMode": false
}
```

**Success Response (200):**
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
  "testMode": false,
  "blockNumber": 12345678,
  "gasUsed": "65000",
  "onChainSuccess": true,
  "dryRun": false,
  "transferError": null
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["userAddress is missing or invalid"]
}
```

**400 - Insufficient Balance:**
```json
{
  "success": false,
  "error": "Insufficient balance for redemption",
  "details": {
    "requestedAmount": 100,
    "availableBalance": 50,
    "shortfall": 50
  }
}
```

**404 - User Not Found:**
```json
{
  "success": false,
  "error": "No deposits found for this user address and chain"
}
```

**503 - Transfer Failed:**
```json
{
  "success": false,
  "error": "Transfer failed",
  "details": {
    "transferError": "Insufficient USDT balance in treasury",
    "message": "Reserve and deposit updates have been rolled back"
  }
}
```

## 🔧 Implementation Details

### Database Updates
The endpoint updates deposit documents with:
- **currentBalance**: Reduced by redeemed amount
- **lastRedeemedAt**: Timestamp of redemption
- **lastRedeemedAmount**: Amount redeemed
- **lastRedeemedTxHash**: Generated transaction hash

### Proportional Redemption
If a user has multiple deposits, the redemption is distributed proportionally across all deposits with available balance.

## 🔗 On-Chain Integration

### Supported Chains
- **Ethereum (Chain ID: 1)**: USDT contract `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- **Base (Chain ID: 8453)**: USDT contract `0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0`

### Treasury Setup
The system uses dedicated treasury wallets for each chain:
- **Ethereum Treasury**: Configured via `ETHEREUM_PRIVATE_KEY`
- **Base Treasury**: Configured via `BASE_PRIVATE_KEY`

### Transfer Process
1. **Gas Estimation**: Estimates gas for the USDT transfer
2. **Balance Check**: Verifies treasury has sufficient USDT
3. **Transaction Execution**: Sends USDT transfer transaction
4. **Confirmation**: Waits for transaction confirmation
5. **Logging**: Records transaction hash, block number, and gas used

### Dry Run Mode
When `DRY_RUN=true` or `testMode=true`, the system simulates transfers without executing actual blockchain transactions.

## 🧪 Testing

### Test Scripts

#### Basic Redemption Testing
Use `testRedeem.js` to test the endpoint:

```bash
cd backend
node testRedeem.js
```

#### On-Chain Transfer Testing
Use `testOnChainTransfer.js` to test the complete on-chain integration:

```bash
cd backend
node testOnChainTransfer.js
```

### Test Scenarios
The basic test script covers:
1. **Partial Redemption**: Redeem 25 USDT from 100 USDT deposit
2. **Multiple Redemptions**: Multiple partial redemptions
3. **Over-Redemption**: Attempt to redeem more than available (should fail)
4. **Full Redemption**: Redeem remaining balance
5. **State Verification**: Check deposit state after each operation

The on-chain test script covers:
1. **Chain Configuration**: Validate RPC endpoints and private keys
2. **Direct Transfers**: Test USDT transfers directly via ethers.js
3. **End-to-End Redemption**: Test complete redemption flow with on-chain payouts
4. **Dry Run Mode**: Test simulation mode without actual transfers
5. **Error Handling**: Test various failure scenarios

### Manual Testing
```bash
# Test with curl (test mode)
curl -X POST http://localhost:4000/api/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    "chainId": 8453,
    "redeemAmount": 5,
    "tokenType": "USDT",
    "testMode": true
  }'

# Test with curl (live mode - be careful!)
curl -X POST http://localhost:4000/api/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1",
    "chainId": 8453,
    "redeemAmount": 5,
    "tokenType": "USDT",
    "testMode": false
  }'
```

## 🔒 Safety Features

### Input Validation
- **userAddress**: Must be a valid string
- **chainId**: Must be 1 or 8453
- **redeemAmount**: Must be a positive number
- **tokenType**: Must be a valid string

### Database Protection
- **Test Data Exclusion**: Only processes real deposits (`isTestData: false`)
- **Balance Checks**: Prevents over-redemption
- **Transaction Safety**: Uses MongoDB atomic operations

### Error Handling
- **Detailed Error Messages**: Clear feedback for debugging
- **Graceful Failures**: Proper HTTP status codes
- **Logging**: Comprehensive server-side logging

## 📊 Database Schema Updates

The deposit schema now includes redemption tracking fields:

```javascript
{
  // ... existing fields ...
  lastRedeemedAt: { type: Date, default: null },
  lastRedeemedAmount: { type: Number, default: null },
  lastRedeemedTxHash: { type: String, default: null },
}
```

## 🚀 Future Enhancements

### Planned Features
1. **Real Blockchain Integration**: Replace mock transactions with actual USDT transfers
2. **Gas Fee Handling**: Calculate and handle gas fees for transactions
3. **Batch Redemptions**: Support for multiple token types in one request
4. **Redemption Limits**: Daily/weekly redemption limits
5. **Audit Trail**: Enhanced logging for compliance

### Integration Points
- **Ethers.js**: For actual USDT contract interactions
- **Gas Estimation**: For transaction cost calculation
- **Transaction Monitoring**: For confirmation tracking
- **Webhook Support**: For real-time status updates

## 🔧 Configuration

### Environment Variables
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 4000)
- `ETHEREUM_PRIVATE_KEY`: Private key for Ethereum treasury wallet
- `BASE_PRIVATE_KEY`: Private key for Base treasury wallet
- `INFURA_API_KEY`: Infura API key for Ethereum RPC
- `ALCHEMY_BASE_URL`: Alchemy RPC URL for Base network
- `DRY_RUN`: Set to "true" to simulate transfers without actual blockchain transactions

### Rate Limiting
The endpoint inherits the same rate limiting as other API endpoints:
- 5 requests per 15 minutes per IP

## 📝 Usage Examples

### Frontend Integration
```javascript
const redeemUSDT = async (userAddress, amount, testMode = false) => {
  const response = await fetch('/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      chainId: 8453,
      redeemAmount: amount,
      tokenType: 'USDT',
      testMode: testMode
    })
  });
  
  const result = await response.json();
  return result;
};
```

### Error Handling
```javascript
try {
  const result = await redeemUSDT(address, amount, false);
  if (result.success) {
    console.log(`Redeemed ${result.redeemedAmount} USDT`);
    console.log(`New balance: ${result.newBalance} USDT`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`Block: ${result.blockNumber}`);
    console.log(`Gas used: ${result.gasUsed}`);
    console.log(`On-chain success: ${result.onChainSuccess}`);
  } else if (result.error === 'Transfer failed') {
    console.error('On-chain transfer failed:', result.details.transferError);
  } else {
    console.error('Redemption failed:', result.error);
  }
} catch (error) {
  console.error('Network error:', error);
}
```
