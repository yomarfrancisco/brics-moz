import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';

/**
 * One-time backfill script to mirror balanceZAR to balanceUSDT for existing users.
 * Safe and idempotent - only updates users where balanceUSDT is null/undefined.
 * 
 * Guarded by ALLOW_ADMIN_ENDPOINTS env var for safety.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (process.env.ALLOW_ADMIN_ENDPOINTS !== 'true') {
    return res.status(403).json({ ok: false, error: 'admin_endpoints_disabled' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Get all users where balanceUSDT is missing
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if balanceUSDT already exists
      if ('balanceUSDT' in data && data.balanceUSDT !== null && data.balanceUSDT !== undefined) {
        skipped++;
        continue;
      }

      // Mirror from balanceZAR or balance, fallback to 0
      const zarValue = Number(data.balanceZAR ?? data.balance ?? 0);
      
      batch.update(doc.ref, { balanceUSDT: zarValue });
      batchCount++;
      updated++;

      // Commit batch if at limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('[backfill-balance-usdt] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

