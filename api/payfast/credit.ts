import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../_firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ref = (req.query.ref as string) || (req.body && (req.body.ref as string));

    if (!ref) return res.status(400).json({ error: 'ref_required' });

    const paymentRef = db.collection('payments').doc(ref);

    const result = await db.runTransaction(async (t) => {
      // ---- ALL READS FIRST ----
      const paySnap = await t.get(paymentRef);

      if (!paySnap.exists) {
        throw new Error('payment_not_found');
      }

      const pay = paySnap.data() as {
        uid: string;
        amountZAR: number;
        status: 'PENDING' | 'COMPLETE' | 'CREDITED' | 'FAILED';
      };

      const uid = pay.uid;
      const amountZAR = Number(pay.amountZAR || 0);

      const userRef = db.collection('users').doc(uid);

      // Read user before any write (canonical balances structure)
      const userSnap = await t.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : {};
      
      // Read from canonical balances structure
      const currentBalZAR = Number(userData?.balances?.ZAR ?? userData?.balanceZAR ?? 0);
      const currentBalUSDT = Number(userData?.balances?.USDT ?? userData?.balanceUSDT ?? currentBalZAR);
      
      // If already credited, return current balance
      if (pay.status === 'CREDITED') {
        return { credited: false, ref, uid, amountZAR, newBalance: currentBalUSDT };
      }

      const newBalanceZAR = currentBalZAR + amountZAR;
      const newBalanceUSDT = currentBalUSDT + amountZAR; // mirror 1:1 until FX

      // ---- WRITES AFTER ALL READS ----
      t.update(paymentRef, {
        status: 'CREDITED',
        via: 'credit',
        creditedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update canonical balances structure + legacy mirrors for backwards compat
      t.set(userRef, {
        'balances.USDT': newBalanceUSDT,
        'balances.ZAR': newBalanceZAR,
        // Legacy mirrors (temporary)
        balanceZAR: newBalanceZAR,
        balanceUSDT: newBalanceUSDT,
        balance: newBalanceZAR,
      }, { merge: true });

      // write an itn log within the same tx (allowed)
      const itnRef = db.collection('itn_events').doc();
      t.set(itnRef, {
        type: 'credit',
        ref,
        uid,
        amountZAR,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { credited: true, ref, uid, amountZAR, newBalance: newBalanceUSDT }; // return USDT balance
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = msg === 'payment_not_found' ? 404 : 500;
    return res.status(code).json({ error: code === 404 ? 'payment_not_found' : 'internal_error', detail: msg });
  }
}
