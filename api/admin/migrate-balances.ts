import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';

/**
 * Idempotent migration endpoint to canonicalize balance structure.
 * Migrates users from legacy fields (balance, balanceZAR, balanceUSDT) to:
 *   balances: { USDT: number, ZAR: number }
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
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if already migrated
      if (data._migratedBalances === true && data.balances?.USDT !== undefined && data.balances?.ZAR !== undefined) {
        skipped++;
        continue;
      }

      // Extract existing values
      const existingUSDT = Number(data.balanceUSDT ?? data.balanceZAR ?? data.balance ?? 0);
      const existingZAR = Number(data.balanceZAR ?? data.balance ?? existingUSDT);
      
      // Build canonical balances object
      const balances = {
        USDT: existingUSDT,
        ZAR: existingZAR,
      };

      // Update with canonical structure + legacy mirrors for backwards compat
      batch.update(doc.ref, {
        balances,
        // Legacy mirrors (temporary, for backwards compat)
        balanceUSDT: existingUSDT,
        balanceZAR: existingZAR,
        balance: existingZAR,
        _migratedBalances: true,
      });
      
      batchCount++;
      migrated++;

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
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('[migrate-balances] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

