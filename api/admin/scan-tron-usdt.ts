/**
 * Scanner endpoint: Scan TRC-20 Transfer logs and update Firestore balances
 * POST /api/admin/scan-tron-usdt
 * Admin-only (requires admin secret)
 * 
 * Scans for TRC-20 Transfer events from the USDT contract and updates Firestore
 * balances for matching user addresses. Uses cursor to track last processed block.
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../_firebaseAdmin.js';
import { createTronWeb, getUsdtContractAddress } from '../_tron.js';
import { recordJournalAndUpdateBalance, resolveWalletHandle } from '../_ledger.js';
import crypto from 'crypto';

const ADMIN_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || '';
const TREASURY_ADDRESS = process.env.TRON_TREASURY_ADDRESS || '';

/**
 * Get TRC-20 Transfer events from contract
 * Uses TronGrid API to fetch contract events
 */
async function getTransferEvents(
  tronWeb: any,
  contractAddress: string,
  fromBlock?: number,
  toBlock?: number
): Promise<any[]> {
  try {
    // Use TronWeb to get contract events
    // For TRON, we can use trx.getContractEvents or TronGrid API
    const events = await tronWeb.getEventResult(contractAddress, {
      eventName: 'Transfer',
      blockNumber: fromBlock ? `${fromBlock}` : undefined,
      blockNumberEnd: toBlock ? `${toBlock}` : undefined,
      onlyConfirmed: true,
    });
    
    return events || [];
  } catch (e: any) {
    console.error('[scanner] Error fetching transfer events:', e);
    return [];
  }
}

/**
 * Build address -> uid map for all users with TRON addresses
 */
async function buildAddressToUidMap(): Promise<Map<string, { uid: string; handle?: string }>> {
  const map = new Map<string, { uid: string; handle?: string }>();
  
  const usersSnapshot = await db.collection('users')
    .where('chain_addresses.tron.address', '!=', null)
    .get();
  
  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();
    const tronAddress = userData.chain_addresses?.tron?.address;
    const handle = userData.handle;
    
    if (tronAddress) {
      map.set(tronAddress, { uid, handle });
    }
  }
  
  return map;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Admin auth check
    const secret = req.headers['x-admin-secret'] || req.body?.secret || '';
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    console.log('[scanner] Starting TRON USDT scan');

    const tronWeb = createTronWeb();
    const usdtContract = getUsdtContractAddress();
    
    // Get cursor (last processed block)
    const cursorRef = db.collection('ops').doc('cursors').collection('tron_usdt').doc('last');
    const cursorDoc = await cursorRef.get();
    const lastProcessedBlock = cursorDoc.exists ? (cursorDoc.data()?.blockNumber ?? 0) : 0;
    
    // Get current block
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    const currentBlockNumber = currentBlock?.block_header?.raw_data?.number ?? 0;
    
    console.log('[scanner] Block range', { lastProcessedBlock, currentBlockNumber });
    
    if (lastProcessedBlock >= currentBlockNumber) {
      return res.status(200).json({
        ok: true,
        processed: 0,
        message: 'No new blocks to process',
        lastProcessedBlock,
        currentBlockNumber,
      });
    }
    
    // Build address map
    const addressMap = await buildAddressToUidMap();
    console.log('[scanner] Address map size', addressMap.size);
    
    // Get transfer events (scan last 100 blocks at a time for safety)
    const scanToBlock = Math.min(lastProcessedBlock + 100, currentBlockNumber);
    const events = await getTransferEvents(tronWeb, usdtContract, lastProcessedBlock + 1, scanToBlock);
    
    let processed = 0;
    const results: any[] = [];
    
    for (const event of events) {
      try {
        const from = event.result?.from || event.result?.[0];
        const to = event.result?.to || event.result?.[1];
        const value = event.result?.value || event.result?.[2];
        
        if (!from || !to || !value) continue;
        
        // Convert value from smallest unit to USDT (6 decimals)
        const amountUSDT = Number(value) / 1_000_000;
        const amountStr = amountUSDT.toFixed(6);
        
        // Check if 'to' address matches a user
        const userInfo = addressMap.get(to);
        
        if (userInfo) {
          // This is a deposit to a user address
          const { journalId } = await recordJournalAndUpdateBalance({
            kind: 'sweep', // or 'deposit' depending on source
            txid: event.transaction || event.transactionHash || '',
            logIndex: event.logIndex || event.index,
            block: event.blockNumber || event.block,
            ts: new Date(event.timestamp || Date.now()),
            uid: userInfo.uid,
            handle: userInfo.handle,
            amountStr,
            asset: 'USDT_TRON',
            meta: { 
              from,
              to,
              scanner: 'scan-tron-usdt',
              isTreasury: from === TREASURY_ADDRESS,
            },
          });
          
          processed++;
          results.push({ uid: userInfo.uid, handle: userInfo.handle, amount: amountStr, journalId });
        }
      } catch (e: any) {
        console.error('[scanner] Error processing event:', e);
      }
    }
    
    // Update cursor
    await cursorRef.set({
      blockNumber: scanToBlock,
      lastScanAt: admin.firestore.FieldValue.serverTimestamp(),
      eventsProcessed: processed,
    }, { merge: true });
    
    console.log('[scanner] Processed', { processed, totalEvents: events.length });
    
    return res.status(200).json({
      ok: true,
      processed,
      lastProcessedBlock: scanToBlock,
      currentBlockNumber,
      results,
    });
  } catch (e: any) {
    console.error('[scanner] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      stack: e.stack,
    });
  }
}

