# Balance Fixer Script

This script fixes the `currentBalance` field in the MongoDB `deposits` collection by ensuring it's correctly calculated as:

```
currentBalance = amount + accumulatedYield
```

## Files

- `fixBalances.js` - Main script that connects to MongoDB and fixes balances
- `testFixBalances.js` - Test script that demonstrates the logic without database connection
- `README-balance-fixer.md` - This documentation

## Prerequisites

1. **Environment Variables**: Ensure you have a `.env` file in the parent directory with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

2. **Dependencies**: The script uses `mongoose` and `dotenv` which should already be installed in the backend directory.

## Usage

### Test the Logic (Safe)
```bash
cd backend
node testFixBalances.js
```

This will show you what changes would be made without actually modifying the database.

### Fix Balances in Production Database
```bash
cd backend
node fixBalances.js
```

⚠️ **Warning**: This will modify the production database. Make sure you have a backup first.

## What the Script Does

1. **Connects to MongoDB** using the `MONGODB_URI` from environment variables
2. **Fetches all deposits** from the `deposits` collection
3. **For each deposit**:
   - Parses `amount` and `accumulatedYield` as numbers
   - Calculates correct balance: `amount + accumulatedYield`
   - Compares with current `currentBalance`
   - Updates if different (using small epsilon for float comparison)
4. **Logs all changes** with detailed information
5. **Provides a summary** of fixed vs unchanged deposits

## Example Output

```
🚀 Starting Balance Fixer Script
================================
🔌 Connecting to MongoDB...
📊 URI: mongodb+srv://****@cluster.mongodb.net/usdt-deposits
✅ MongoDB connected successfully
🗄️  Database: usdt-deposits

🔧 Starting balance fix process...
📥 Fetching all deposits from database...
📊 Found 4 deposits to check

🔧 Fixing deposit 68a84269b99e5683345d43c5:
   User: 0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1
   Chain: 1
   Amount: 1
   Accumulated Yield: 0
   Old Balance: 2
   New Balance: 1
   Difference: -1

📋 Balance Fix Summary:
✅ Fixed: 4 deposits
ℹ️  Unchanged: 0 deposits
📊 Total processed: 4 deposits

📝 Updated Deposits:
1. Deposit ID: 68a84269b99e5683345d43c5
   User: 0xdd7fc80cafb2f055fb6a519d4043c29ea76a7ce1
   Chain: 1
   Old Balance: 2
   New Balance: 1
   Difference: -1
   TX Hash: 0xd8ed7ec4c5339044171d758d943ebe5e41d96630814bb1d19ee0c370fc407cac

🎉 Balance fix process completed successfully!
🔌 Disconnected from MongoDB
```

## Safety Features

- **Float Comparison**: Uses epsilon (0.001) to avoid floating-point precision issues
- **Detailed Logging**: Shows exactly what changes are being made
- **Error Handling**: Graceful error handling with detailed error messages
- **Test Mode**: Use `testFixBalances.js` to preview changes without modifying data

## Database Schema

The script works with the following MongoDB schema:

```javascript
{
  _id: ObjectId,
  userAddress: String,
  amount: Number,
  currentBalance: Number,
  accumulatedYield: Number,
  chainId: Number,
  txHash: String,
  // ... other fields
}
```

## Troubleshooting

### Connection Issues
- Ensure `MONGODB_URI` is set in your `.env` file
- Check network connectivity to MongoDB
- Verify the connection string format

### Permission Issues
- Ensure the MongoDB user has read/write permissions on the `deposits` collection

### Schema Issues
- The script expects the exact schema from `server.js`
- If the schema changes, update the script accordingly
