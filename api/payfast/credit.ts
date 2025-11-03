import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import admin from 'firebase-admin';
import { rGetJSON, rSetJSON, pf } from '../redis.js';

export const dynamic = 'force-dynamic';

const ALLOW_PROVISIONAL = process.env.ALLOW_PROVISIONAL === 'true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Feature flag check with logging
  console.log('[credit] ALLOW_PROVISIONAL=', process.env.ALLOW_PROVISIONAL, 'parsed=', ALLOW_PROVISIONAL);
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

    // Load stub from Redis pf:pay:{ref}
    const stub = await rGetJSON<any>(pf.pay(ref));

    if (!stub) {
      return res.status(404).json({ error: 'stub_not_found' });
    }

    const userId = stub.userId || stub.uid;
    const amountZAR = stub.amountZAR;

    if (!userId || !amountZAR || !Number.isFinite(amountZAR)) {
      return res.status(422).json({ error: 'malformed_stub', detail: 'missing userId or amountZAR' });
    }

    // Idempotency check: if already CREDITED, return early
    if (stub.status === 'CREDITED') {
      // Read balance from Firestore
      const userDoc = await db.collection('users').doc(userId).get();
      const balance = userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : 0;
      return res.status(200).json({
        ok: true,
        credited: false,
        ref,
        userId,
        amountZAR,
        balance,
      });
    }

    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);

    // Firestore writes: payments/{ref}, users/{userId}, itn_events/{autoId}
    await db.runTransaction(async (tx) => {
      const payRef = db.collection('payments').doc(ref);
      const userRef = db.collection('users').doc(userId);

      // Update payment status to CREDITED with full stub
      tx.set(payRef, {
        ...stub,
        status: 'CREDITED',
        creditedAt: nowTs,
      }, { merge: true });

      // Ensure user doc exists, then increment balanceZAR
      tx.set(userRef, { createdAt: nowTs }, { merge: true });
      tx.update(userRef, {
        balanceZAR: admin.firestore.FieldValue.increment(amountZAR),
        updatedAt: nowTs,
      });
    });

    // Append ITN event log
    await db.collection('itn_events').add({
      ref,
      action: 'CREDIT',
      amountZAR,
      userId,
      ts: nowTs,
    });

    // Update Redis stub to CREDITED (idempotent)
    const updatedStub = {
      ...stub,
      status: 'CREDITED',
      creditedAt: now.getTime(),
    };
    await rSetJSON(pf.pay(ref), updatedStub, 60 * 60 * 6); // 6 hour TTL

    // Read new balance from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const newBalance = userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : amountZAR;

    console.log('[credit] success', { ref, uid: userId, amount: amountZAR, newBalance });

    return res.status(200).json({
      ok: true,
      ref,
      userId,
      amountZAR,
      newBalance,
    });
  } catch (err: any) {
    console.error('payfast:credit', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}
