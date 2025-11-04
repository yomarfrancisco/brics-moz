/**
 * Ledger sync endpoint: Sync Firestore balance with on-chain USDT balance
 * POST /api/admin/ledger-sync-from-chain
 * Body: { "handle": "@brics_f0qkuc", "asset": "USDT_TRON", "source": "treasury-refill", "txid": "..." }
 * 
 * Admin-only (requires admin secret)
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../_firebaseAdmin.js';
import { createTronWeb, getUsdtBalanceRaw } from '../_tron.js';

const ADMIN_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || '';

/**
 * Resolve wallet handle to uid and TRON address
 */
async function resolveWalletHandle(handle: string): Promise<{ uid: string; tronAddress: string }> {
  // Normalize handle: strip @ if present, lowercase
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
  
  // Validate handle format
  if (!/^[a-z0-9_]{3,15}$/.test(normalizedHandle)) {
    throw new Error(`Invalid handle format: ${handle}`);
  }
  
  // Look up handle in Firestore
  const handleRef = db.collection('handles').doc(normalizedHandle);
  const handleDoc = await handleRef.get();
  
  if (!handleDoc.exists) {
    throw new Error(`Handle not found: ${handle}`);
  }
  
  const uid = handleDoc.data()!.uid as string;
  if (!uid) {
    throw new Error(`Handle has no uid: ${handle}`);
  }
  
  // Look up user's TRON address
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`User not found for handle: ${handle}`);
  }
  
  const tronAddress = userDoc.data()?.chain_addresses?.tron?.address;
  if (!tronAddress) {
    throw new Error(`User has no TRON address for handle: ${handle}`);
  }
  
  return { uid, tronAddress };
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { handle, asset, source, txid } = body as {
      handle: string;
      asset?: string;
      source?: string;
      txid?: string;
    };

    if (!handle) {
      return res.status(400).json({ ok: false, error: 'handle required' });
    }

    console.log('[ledger-sync] Starting sync for handle', { handle, asset, source, txid });

    // Resolve handle to uid and TRON address
    const { uid, tronAddress } = await resolveWalletHandle(handle);
    console.log('[ledger-sync] Resolved handle', { handle, uid, tronAddress });

    // Get on-chain balance
    const tronWeb = createTronWeb();
    const balanceRaw = await getUsdtBalanceRaw(tronWeb, tronAddress);
    const balanceUSDT = Number(balanceRaw) / 1_000_000;
    const balanceUSDTStr = balanceUSDT.toFixed(6);
    
    console.log('[ledger-sync] On-chain balance', { tronAddress, balanceRaw, balanceUSDTStr });

    // Get current Firestore balance
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const currentBalance = userDoc.data()?.balances?.USDT ?? userDoc.data()?.balanceUSDT ?? 0;
    const currentBalanceStr = Number(currentBalance).toFixed(6);
    
    console.log('[ledger-sync] Current Firestore balance', { uid, currentBalanceStr });

    // Update Firestore balance to match on-chain
    await userRef.update({
      'balances.USDT': balanceUSDT,
      balanceUSDT: balanceUSDT, // Keep legacy field for backwards compat
      // Also update ZAR if needed (for now, keep it as is)
    });

    console.log('[ledger-sync] Updated Firestore balance', { 
      uid, 
      from: currentBalanceStr, 
      to: balanceUSDTStr 
    });

    // Create audit entry
    const auditId = db.collection('ledger_audit').doc().id;
    await db.collection('ledger_audit').doc(auditId).set({
      id: auditId,
      uid,
      handle: handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase(),
      type: 'ledger_sync',
      source: source || 'manual',
      asset: asset || 'USDT_TRON',
      amount: balanceUSDTStr,
      balanceBefore: currentBalanceStr,
      balanceAfter: balanceUSDTStr,
      txid: txid || null,
      tronAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[ledger-sync] Created audit entry', { auditId });

    return res.status(200).json({
      ok: true,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      uid,
      tronAddress,
      balanceBefore: currentBalanceStr,
      balanceAfter: balanceUSDTStr,
      delta: (balanceUSDT - Number(currentBalance)).toFixed(6),
      auditId,
      txid: txid || null,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[ledger-sync] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      stack: e.stack,
    });
  }
}

