/**
 * Treasury refill endpoint: Transfer USDT from treasury to a wallet handle
 * POST /api/admin/treasury-refill
 * Body: { handle: "@brics_f0qkuc", amount: "5" }
 * 
 * Admin-only (requires admin secret or auth token)
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import { createTronWeb, normalizeTronAddress, transferUsdtViaBuilder, getUsdtBalanceRaw } from '../_tron.js';

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
    const { handle, amount } = body as {
      handle: string;
      amount: string | number;
    };

    if (!handle) {
      return res.status(400).json({ ok: false, error: 'handle required' });
    }

    const amountNum = Number(amount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ ok: false, error: 'amount must be > 0' });
    }

    console.log('[brics-refill] Starting treasury refill', { handle, amount: amountNum });

    // Create TronWeb instance with treasury key
    const tronWeb = createTronWeb();
    
    // Resolve handle to TRON address
    const toAddress = await resolveWalletHandle(handle);
    console.log('[brics-refill] Resolved handle to address', { handle, toAddress });

    // Validate and normalize address
    if (!tronWeb.isAddress(toAddress)) {
      throw new Error(`Invalid TRON address: ${toAddress}`);
    }
    
    const normalized = normalizeTronAddress(tronWeb, toAddress);
    console.log('[brics-refill] Normalized address', { toAddress, normalized });

    // Get balance before transfer (for verification)
    const balanceBefore = await getUsdtBalanceRaw(tronWeb, toAddress);
    const balanceBeforeUSDT = (Number(balanceBefore) / 1_000_000).toFixed(6);
    console.log('[brics-refill] Balance before', { toAddress, balanceBeforeUSDT });

    // Convert amount to SUN (6 decimals)
    const amountSun = BigInt(Math.round(amountNum * 1_000_000));
    
    // Execute transfer
    console.log('[brics-refill] Executing transfer', { to: normalized, amountSun: amountSun.toString() });
    const result = await transferUsdtViaBuilder(tronWeb, normalized, amountSun);
    
    const txid = result?.txid || result?.txID || result?.transaction?.txID || null;
    
    if (!txid) {
      throw new Error('Failed to extract transaction ID from transfer result');
    }

    console.log('[brics-refill] Transfer successful', { handle, toAddress, amount: amountNum, txid });

    // Wait a moment for transaction to propagate, then check balance
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const balanceAfter = await getUsdtBalanceRaw(tronWeb, toAddress);
    const balanceAfterUSDT = (Number(balanceAfter) / 1_000_000).toFixed(6);
    const delta = (Number(balanceAfterUSDT) - Number(balanceBeforeUSDT)).toFixed(6);
    
    console.log('[brics-verify] Balance after', { toAddress, balanceAfterUSDT, delta });

    return res.status(200).json({
      ok: true,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      to: toAddress,
      toHex: normalized,
      amount: amountNum.toString(),
      amountSun: amountSun.toString(),
      txid,
      balanceBefore: balanceBeforeUSDT,
      balanceAfter: balanceAfterUSDT,
      delta,
      verified: Math.abs(Number(delta) - amountNum) < 0.000001, // Allow tiny floating point drift
    });
  } catch (e: any) {
    console.error('[brics-refill] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      stack: e.stack,
    });
  }
}

