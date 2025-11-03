import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

const ALLOW_PROVISIONAL = process.env.ALLOW_PROVISIONAL === 'true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Feature flag check
  if (!ALLOW_PROVISIONAL) {
    return res.status(403).json({ error: 'provisional_credit_disabled' });
  }

  try {
    // Read ref from query, JSON body, or form-encoded body
    const ref =
      (req.query.ref as string) ||
      (req.headers['content-type']?.includes('application/json') ? (req.body?.ref as string) : undefined) ||
      (req.headers['content-type']?.includes('application/x-www-form-urlencoded') ? (req.body?.ref as string) : undefined);

    if (!ref) {
      return res.status(400).json({ error: 'ref_required' });
    }

    // Load payment from Firestore
    const payDoc = await db.collection('payments').doc(ref).get();

    if (!payDoc.exists) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    const pay = payDoc.data()!;
    const uid = pay.uid;
    const amountZAR = pay.amountZAR;

    if (!uid || !amountZAR || !Number.isFinite(amountZAR)) {
      return res.status(422).json({ error: 'malformed_stub', detail: 'missing uid or amountZAR' });
    }

    // Firestore transaction for idempotent credit
    let credited = false;
    let newBalance = 0;

    await db.runTransaction(async (tx) => {
      const payRef = db.collection('payments').doc(ref);
      const paySnap = await tx.get(payRef);

      if (!paySnap.exists) {
        throw new Error('payment not found during transaction');
      }

      const paymentData = paySnap.data()!;

      // If already CREDITED, skip credit
      if (paymentData.status === 'CREDITED') {
        return; // No-op, already credited
      }

      // Mark as CREDITED
      tx.set(payRef, {
        status: 'CREDITED',
        via: 'credit',
      }, { merge: true });

      // Ensure user doc exists, then increment balanceZAR
      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) {
        // Create user doc with initial balance of 0
        tx.set(userRef, { balanceZAR: 0 });
      }

      // Increment balance atomically
      tx.update(userRef, {
        balanceZAR: admin.firestore.FieldValue.increment(amountZAR),
      });

      credited = true;
    });

    // Read new balance after transaction
    if (credited) {
      const userDoc = await db.collection('users').doc(uid).get();
      newBalance = userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : amountZAR;

      // Log credit event
      await db.collection('itn_events').add({
        ref,
        uid,
        type: 'credit',
        amountZAR,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('[credit]', { ref, uid, amountZAR, newBalance });
    } else {
      // Already credited - read current balance
      const userDoc = await db.collection('users').doc(uid).get();
      newBalance = userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : 0;
      console.log('[credit] already credited', { ref, uid });
    }

    return res.status(200).json({
      ok: true,
      credited,
      ref,
      uid,
      amountZAR,
      newBalance,
    });
  } catch (err: any) {
    console.error('payfast:credit', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}
