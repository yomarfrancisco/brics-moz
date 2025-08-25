import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!SHEET_ID) {
  console.warn('⚠️ GOOGLE_SHEET_ID not set — skipping sheet operations.');
  // Don't exit, just continue without sheets functionality
}

const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
if (Object.keys(credentials).length === 0) {
  console.warn('⚠️ GOOGLE_SHEETS_CREDENTIALS not set — skipping sheet operations.');
  // Don't exit, just continue without sheets functionality
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const chainNames = {
  1: 'Ethereum',
  8453: 'Base',
  10: 'Optimism',
  42161: 'Arbitrum',
  11155111: 'Sepolia',
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

export async function syncDepositsToSheet(deposits) {
  if (!SHEET_ID || Object.keys(credentials).length === 0) {
    console.warn('⚠️ GOOGLE_SHEET_ID or credentials not set — skipping sheet sync.');
    return; // safely skip instead of crashing
  }
  
  try {
    const chainNameMap = {
      1: 'Ethereum',
      8453: 'Base',
      10: 'Optimism',
      42161: 'Arbitrum',
      11155111: 'Sepolia',
    };

    const groupedDeposits = deposits.reduce((acc, deposit) => {
      const dateStr = deposit.date.toISOString().split('T')[0].split('-').join('/');
      const key = `${dateStr}_${deposit.userAddress.toLowerCase()}_${deposit.chainId}`;
      if (!acc[key]) {
        acc[key] = {
          date: dateStr,
          userAddress: deposit.userAddress,
          chain: chainNameMap[deposit.chainId] || `Chain ${deposit.chainId}`,
          totalAmount: 0,
          currentBalance: 0,
          tokenType: deposit.tokenType,
          txHashes: [],
          maturityDates: [],
          accumulatedYield: 0,
          dailyYieldAmount: 0,
          dailyYieldPercent: deposit.dailyYieldPercent || 0.5,
          yieldGoalMet: deposit.yieldGoalMet || false,
          timestamps: [],
          lastGoalMet: deposit.lastGoalMet ? deposit.lastGoalMet.toISOString().split('T')[0].split('-').join('/') : '',
        };
      }
      acc[key].totalAmount += deposit.amount;
      acc[key].currentBalance = deposit.currentBalance;
      acc[key].accumulatedYield += deposit.accumulatedYield || 0;
      acc[key].dailyYieldAmount += deposit.dailyYield || 0;
      acc[key].txHashes.push(deposit.txHash);
      acc[key].timestamps.push(deposit.timestamp.toISOString());
      acc[key].maturityDates.push(deposit.maturityDate ? deposit.maturityDate.toISOString().split('T')[0].split('-').join('/') : '');
      acc[key].yieldGoalMet = acc[key].yieldGoalMet || deposit.yieldGoalMet;
      if (deposit.lastGoalMet && (!acc[key].lastGoalMet || deposit.lastGoalMet > new Date(acc[key].lastGoalMet))) {
        acc[key].lastGoalMet = deposit.lastGoalMet.toISOString().split('T')[0].split('-').join('/');
      }
      return acc;
    }, {});

    const values = Object.values(groupedDeposits).map(group => {
      // Prioritize sheet values if they differ from backend
      return [
        group.date,
        group.userAddress,
        group.totalAmount,
        group.currentBalance,
        group.tokenType,
        group.txHashes.join(', '),
        group.chain,
        group.maturityDates.filter(Boolean).join(', ') || '',
        group.accumulatedYield, // Use backend value, but will be overridden by sheet if updated
        group.dailyYieldAmount, // Use backend value, but will be overridden by sheet if updated
        group.dailyYieldPercent.toFixed(2) + '%',
        group.yieldGoalMet,
        group.timestamps.join(', '),
        group.lastGoalMet || '',
      ];
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Deposits!A2:N',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    console.log('Synced deposits to Google Sheet');
  } catch (error) {
    console.error('Error syncing deposits to Sheet:', error);
    throw error;
  }
}

export async function syncWithdrawalsToSheet(withdrawals) {
  if (!SHEET_ID || Object.keys(credentials).length === 0) {
    console.warn('⚠️ GOOGLE_SHEET_ID or credentials not set — skipping withdrawal sync.');
    return; // safely skip instead of crashing
  }
  
  try {
    const chainNameMap = {
      1: 'Ethereum',
      8453: 'Base',
      10: 'Optimism',
      42161: 'Arbitrum',
      11155111: 'Sepolia',
    };

    const values = withdrawals.map(withdrawal => [
      withdrawal.date.toISOString().split('T')[0].split('-').join('/'),
      withdrawal.userAddress,
      withdrawal.amount,
      withdrawal.availableBalance,
      withdrawal.tokenType,
      withdrawal.txHash,
      chainNameMap[withdrawal.chainId] || `Chain ${withdrawal.chainId}`,
      withdrawal.timestamp.toISOString(),
      withdrawal.status,
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Withdrawals!A2:I',
      valueInputOption: 'RAW',
      resource: { values },
    });
    console.log('Synced withdrawals to Google Sheet');
  } catch (error) {
    console.error('Error syncing withdrawals to Sheet:', error);
    throw error;
  }
}

async function ensureCheckboxFormat() {
  try {
    if (!process.env.GOOGLE_SHEET_ID) {
      console.error('Error: GOOGLE_SHEET_ID is not set in environment variables.');
      throw new Error('Missing GOOGLE_SHEET_ID');
    }

    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });
    const sheetId = response.data.sheets.find(sheet => sheet.properties.title === 'Deposits')?.properties.sheetId;
    if (!sheetId) {
      console.error('Error: "Deposits" sheet not found.');
      throw new Error('Invalid sheet ID');
    }

    const request = {
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      resource: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 11,
                endColumnIndex: 12,
              },
              rule: {
                condition: {
                  type: 'BOOLEAN',
                },
                showCustomUi: true,
              },
            },
          },
        ],
      },
    };
    await sheets.spreadsheets.batchUpdate(request);
    console.log('Checkbox format ensured for Yield Goal Met column in sheet ID:', sheetId);
  } catch (error) {
    console.error('Error ensuring checkbox format:', error.message, error.stack);
    throw error;
  }
}

export async function updateYieldFromSheet() {
  if (!SHEET_ID || Object.keys(credentials).length === 0) {
    console.warn('⚠️ GOOGLE_SHEET_ID or credentials not set — skipping yield update.');
    return; // safely skip instead of crashing
  }
  
  try {
    await ensureCheckboxFormat();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Deposits!A2:N',
    });
    const rows = response.data.values || [];
    const updates = [];
    const today = formatDate(new Date());

    for (const row of rows) {
      const date = row[0];
      const userAddress = row[1];
      const totalAmount = parseFloat(row[2]) || 0;
      const currentBalance = parseFloat(row[3]) || 0;
      const chainName = row[6];
      const accumulatedYield = parseFloat(row[8]) || 0;
      const dailyYield = parseFloat(row[9]) || 0;
      const dailyYieldPercent = parseFloat(row[10]?.replace('%', '')) || 0.5;
      const yieldGoalMet = row[11] === 'TRUE' || row[11] === true;
      const lastGoalMet = row[13] || '';

      const chainId = Object.keys(chainNames).find(id => chainNames[id] === chainName);
      if (!chainId) {
        console.warn(`No chainId found for chainName: ${chainName}`);
        continue;
      }

      const dailyYieldRate = dailyYieldPercent / 100;
      const newDailyYield = totalAmount * dailyYieldRate;
      const newAccumulatedYield = accumulatedYield + (yieldGoalMet ? newDailyYield : 0); // Only add if goal met
      const newCurrentBalance = currentBalance + (yieldGoalMet ? newDailyYield : 0); // Only add if goal met

      // Update the sheet with the new values
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `Deposits!D${rows.indexOf(row) + 2}:N${rows.indexOf(row) + 2}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            newCurrentBalance,
            '',
            '',
            '',
            '',
            newAccumulatedYield,
            newDailyYield,
            dailyYieldPercent.toFixed(2) + '%',
            yieldGoalMet,
            '',
            yieldGoalMet ? today : lastGoalMet || '',
          ]],
        },
      });

      // Update backend with the new values
      updates.push({
        userAddress,
        chainId: parseInt(chainId),
        accumulatedYield: newAccumulatedYield,
        dailyYield: newDailyYield,
        dailyYieldPercent,
        currentBalance: newCurrentBalance,
        lastGoalMet: yieldGoalMet ? new Date(today) : new Date(lastGoalMet) || null,
      });
    }

    console.log('Yield updates applied to sheet:', updates);
    return updates;
  } catch (error) {
    console.error('Error updating yield from Sheet:', error.message, error.stack);
    throw error;
  }
}

export async function updateWithdrawalStatusFromSheet() {
  if (!SHEET_ID || Object.keys(credentials).length === 0) {
    console.warn('⚠️ GOOGLE_SHEET_ID or credentials not set — skipping withdrawal status update.');
    return; // safely skip instead of crashing
  }
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Withdrawals!A2:I',
    });
    const rows = response.data.values || [];
    return rows.map(row => ({
      txHash: row[4],
      status: row[7],
      availableBalance: parseFloat(row[3]) || 0,
    }));
  } catch (error) {
    console.error('Error reading withdrawal status from Sheet:', error);
    throw error;
  }
}