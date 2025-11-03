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

      // If already credited, return current balance (read before writes)
      if (pay.status === 'CREDITED') {
        const userSnap = await t.get(userRef);
        const bal = (userSnap.exists ? (userSnap.data()?.balanceZAR as number) : 0) || 0;
        return { credited: false, ref, uid, amountZAR, newBalance: bal };
      }

      // Read user before any write
      const userSnap = await t.get(userRef);
      const currentBal = (userSnap.exists ? (userSnap.data()?.balanceZAR as number) : 0) || 0;
      const newBalance = currentBal + amountZAR;

      // ---- WRITES AFTER ALL READS ----
      t.update(paymentRef, {
        status: 'CREDITED',
        via: 'credit',
        creditedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.set(userRef, { balanceZAR: newBalance }, { merge: true });

      // write an itn log within the same tx (allowed)
      const itnRef = db.collection('itn_events').doc();
      t.set(itnRef, {
        type: 'credit',
        ref,
        uid,
        amountZAR,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { credited: true, ref, uid, amountZAR, newBalance };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = msg === 'payment_not_found' ? 404 : 500;
    return res.status(code).json({ error: code === 404 ? 'payment_not_found' : 'internal_error', detail: msg });
  }
}
