/**
 * Treasury verification endpoint: Verify USDT balance for a wallet handle
 * GET /api/admin/treasury-verify?handle=@brics_f0qkuc
 * 
 * Admin-only (requires admin secret or auth token)
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import { createTronWeb, getUsdtBalanceRaw } from '../_tron.js';

const ADMIN_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || '';

/**
 * Resolve wallet handle to TRON address
 */
async function resolveWalletHandle(handle: string): Promise<string> {
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
  
  return tronAddress;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Admin auth check
    const secret = req.headers['x-admin-secret'] || req.query.secret || '';
    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const handle = req.query.handle as string;
    if (!handle) {
      return res.status(400).json({ ok: false, error: 'handle required (query param: ?handle=@brics_f0qkuc)' });
    }

    console.log('[brics-verify] Verifying balance for handle', { handle });

    // Create TronWeb instance
    const tronWeb = createTronWeb();
    
    // Resolve handle to TRON address
    const toAddress = await resolveWalletHandle(handle);
    console.log('[brics-verify] Resolved handle to address', { handle, toAddress });

    // Get current USDT balance
    const balanceRaw = await getUsdtBalanceRaw(tronWeb, toAddress);
    const balanceUSDT = (Number(balanceRaw) / 1_000_000).toFixed(6);
    
    console.log('[brics-verify] Balance check complete', { 
      handle, 
      toAddress, 
      balanceRaw, 
      balanceUSDT 
    });

    // Also check Firestore balance for comparison
    const normalizedHandle = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
    const handleRef = db.collection('handles').doc(normalizedHandle);
    const handleDoc = await handleRef.get();
    const uid = handleDoc.data()!.uid as string;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const firestoreBalance = userDoc.data()?.balances?.USDT ?? userDoc.data()?.balanceUSDT ?? 0;

    return res.status(200).json({
      ok: true,
      verified: true,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      toAddress,
      balanceOnChain: {
        raw: balanceRaw,
        usdt: balanceUSDT,
        decimals: 6,
      },
      balanceInFirestore: {
        usdt: Number(firestoreBalance).toFixed(6),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[brics-verify] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      stack: e.stack,
    });
  }
}

