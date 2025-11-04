/**
 * Reconciliation endpoint: Compare on-chain, Firestore, and journal balances
 * GET /api/admin/recon-usdt?handle=@brics_f0qkuc
 * Admin-only (requires admin secret)
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import { createTronWeb, getUsdtBalanceRaw } from '../_tron.js';
import { resolveWalletHandle } from '../_ledger.js';

const ADMIN_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || '';

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

    console.log('[recon] Starting reconciliation for handle', { handle });

    // Resolve handle
    const { uid, tronAddress } = await resolveWalletHandle(handle);
    
    // Get on-chain balance
    const tronWeb = createTronWeb();
    const balanceRaw = await getUsdtBalanceRaw(tronWeb, tronAddress);
    const balanceOnChain = Number(balanceRaw) / 1_000_000;
    
    // Get Firestore balance
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const balanceFirestore = userDoc.data()?.balances?.USDT ?? userDoc.data()?.balanceUSDT ?? 0;
    
    // Calculate journal sum (credits - debits)
    const journalSnapshot = await db.collection('journal')
      .where('uid', '==', uid)
      .where('asset', '==', 'USDT_TRON')
      .get();
    
    let journalSum = 0;
    const journalEntries: any[] = [];
    
    for (const journalDoc of journalSnapshot.docs) {
      const data = journalDoc.data();
      const amount = Number(data.amountStr || 0);
      journalSum += amount;
      journalEntries.push({
        kind: data.kind,
        amountStr: data.amountStr,
        txid: data.txid,
        ts: data.ts?.toDate?.() || data.ts,
      });
    }
    
    // Calculate drift
    const driftOnChainVsFirestore = balanceOnChain - balanceFirestore;
    const driftFirestoreVsJournal = balanceFirestore - journalSum;
    const driftOnChainVsJournal = balanceOnChain - journalSum;
    
    const hasDrift = Math.abs(driftOnChainVsFirestore) > 0.000001 || 
                     Math.abs(driftFirestoreVsJournal) > 0.000001 ||
                     Math.abs(driftOnChainVsJournal) > 0.000001;
    
    return res.status(200).json({
      ok: true,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      uid,
      tronAddress,
      balances: {
        onChain: balanceOnChain.toFixed(6),
        firestore: Number(balanceFirestore).toFixed(6),
        journalSum: journalSum.toFixed(6),
      },
      drift: {
        onChainVsFirestore: driftOnChainVsFirestore.toFixed(6),
        firestoreVsJournal: driftFirestoreVsJournal.toFixed(6),
        onChainVsJournal: driftOnChainVsJournal.toFixed(6),
      },
      hasDrift,
      journalEntryCount: journalEntries.length,
      journalEntries: journalEntries.slice(0, 10), // Last 10 entries
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[recon] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      stack: e.stack,
    });
  }
}

