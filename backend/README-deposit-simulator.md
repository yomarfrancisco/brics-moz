# Deposit Simulation Script

This script simulates user deposits and yield growth over time in the MongoDB `deposits` collection.

## Files

- `simulateDeposits.js` - Main script that creates deposits and simulates yield growth
- `testSimulateDeposits.js` - Test script that demonstrates the logic without database connection
- `README-deposit-simulator.md` - This documentation

## Features

### 🧩 Core Functionality

1. **Creates 3 synthetic deposits** with:
   - Random Ethereum-like addresses
   - Varying amounts (10, 20, 50 USDT)
   - 0.5% daily yield rate
   - Mixed chains (Base and Ethereum)
   - Tagged with `isTestData: true`

2. **Simulates yield growth** every 10 seconds:
   - Calculates days elapsed since deposit creation
   - Updates `accumulatedYield` and `currentBalance`
   - Uses safe float precision (6 decimal places)

3. **Safety features**:
   - Only affects documents with `isTestData: true`
   - Graceful shutdown with cleanup option
   - Detailed logging of all changes

## Prerequisites

1. **Environment Variables**: Ensure you have a `.env` file in the parent directory with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

2. **Dependencies**: The script uses `mongoose` and `dotenv` which should already be installed.

## Usage

### Test the Logic (Safe)
```bash
cd backend
node testSimulateDeposits.js
```

This demonstrates the yield calculation logic without database interaction.

### Run Live Simulation
```bash
cd backend
node simulateDeposits.js
```

⚠️ **Warning**: This will create and modify documents in your database.

## How It Works

### Initial Deposit Creation
```javascript
const deposit = new Deposit({
  userAddress: generateRandomAddress(),
  amount: 10, // USDT
  currentBalance: 10, // Initially same as amount
  dailyYieldPercent: 0.5,
  isTestData: true, // Safety tag
  // ... other fields
});
```

### Yield Calculation
```javascript
// Calculate days elapsed
const daysElapsed = (now - createdAt) / (1000 * 60 * 60 * 24);

// Calculate yields
const accumulatedYield = amount * (dailyYieldPercent / 100) * daysElapsed;
const currentBalance = amount + accumulatedYield;
const dailyYield = amount * (dailyYieldPercent / 100);
```

### Example Growth
- **10 USDT deposit** with 0.5% daily yield:
  - After 1 day: 10.05 USDT (+0.5%)
  - After 5 days: 10.25 USDT (+2.5%)
  - After 10 days: 10.50 USDT (+5.0%)

## Example Output

```
🚀 Starting Deposit Simulation
==============================
🔌 Connecting to MongoDB...
✅ MongoDB connected successfully

💰 Creating initial test deposits...
✅ Created deposit: 0x51340c...7edb0a - 10 USDT on chain 8453
✅ Created deposit: 0xced3ca...c73bbd - 20 USDT on chain 8453
✅ Created deposit: 0xfa2f66...178b88 - 50 USDT on chain 1
📊 Created 3 test deposits

⏰ Starting yield simulation loop (every 10 seconds)...
   Press Ctrl+C to stop

📈 Updating yields for 3 test deposits...

💰 0x51340c...7edb0a:
   Amount: 10 USDT
   Days Elapsed: 0.00
   Accumulated Yield: 0.000000 USDT
   Current Balance: 10.000000 USDT
   Daily Yield: 0.050000 USDT
   Chain: 8453

💰 0xced3ca...c73bbd:
   Amount: 20 USDT
   Days Elapsed: 0.00
   Accumulated Yield: 0.000000 USDT
   Current Balance: 20.000000 USDT
   Daily Yield: 0.100000 USDT
   Chain: 8453

💰 0xfa2f66...178b88:
   Amount: 50 USDT
   Days Elapsed: 0.00
   Accumulated Yield: 0.000000 USDT
   Current Balance: 50.000000 USDT
   Daily Yield: 0.250000 USDT
   Chain: 1

[After 10 seconds...]

💰 0x51340c...7edb0a:
   Amount: 10 USDT
   Days Elapsed: 0.00
   Accumulated Yield: 0.000000 USDT
   Current Balance: 10.000000 USDT
   Daily Yield: 0.050000 USDT
   Chain: 8453

[Ctrl+C pressed]

🛑 Stopping simulation...

🧹 Do you want to remove test deposits? (y/n)
y
🧹 Cleaning up test data...
✅ Removed 3 test deposits
🔌 Disconnected from MongoDB
```

## Safety Features

- **Test Data Tagging**: All simulated deposits have `isTestData: true`
- **Graceful Shutdown**: Ctrl+C prompts for cleanup
- **Float Precision**: Uses `toFixed(6)` for safe calculations
- **Error Handling**: Comprehensive error handling and logging
- **Connection Management**: Proper MongoDB connection lifecycle

## Database Schema

The script works with the existing deposit schema:

```javascript
{
  _id: ObjectId,
  userAddress: String,
  amount: Number,
  currentBalance: Number,
  accumulatedYield: Number,
  dailyYield: Number,
  dailyYieldPercent: Number,
  chainId: Number,
  txHash: String,
  isTestData: Boolean,
  createdAt: Date,
  updatedAt: Date,
  // ... other fields
}
```

## Troubleshooting

### Connection Issues
- Ensure `MONGODB_URI` is set in your `.env` file
- Check network connectivity to MongoDB

### Duplicate Deposits
- The script checks for existing test deposits
- If found, it will update them instead of creating new ones
- Use cleanup option to remove old test data

### Performance
- Updates every 10 seconds by default
- Only affects documents with `isTestData: true`
- Uses efficient MongoDB operations

## Use Cases

1. **Testing Yield Logic**: Verify yield calculations work correctly
2. **UI Development**: Generate test data for frontend development
3. **Performance Testing**: Test database performance with simulated load
4. **Demo Purposes**: Show yield growth in real-time

## Cleanup

To remove all test deposits:
```bash
# Option 1: Use the script's cleanup prompt
# Press Ctrl+C and answer 'y' when prompted

# Option 2: Manual cleanup in MongoDB
db.deposits.deleteMany({ isTestData: true })
```
