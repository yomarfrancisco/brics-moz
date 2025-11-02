import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, fv, nowTs } from '../_firebase.js';

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
    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'ref_required' });
    }

    // Load payment stub from Firestore
    const payRef = db.collection('payments').doc(ref);
    const paySnap = await payRef.get();

    if (!paySnap.exists) {
      return res.status(404).json({ error: 'stub_not_found' });
    }

    const pay = paySnap.data()!;
    const uid = pay.uid;
    const amountZAR = pay.amountZAR;

    if (!uid || !amountZAR || !Number.isFinite(amountZAR)) {
      return res.status(422).json({ error: 'malformed_stub', detail: 'missing uid or amountZAR' });
    }

    // Check if already credited
    if (pay.status === 'CREDITED') {
      const userSnap = await db.collection('users').doc(uid).get();
      const balance = userSnap.exists ? (userSnap.data()?.balanceZAR ?? 0) : 0;
      return res.status(200).json({
        ok: true,
        alreadyCredited: true,
        balance,
      });
    }

    // Credit using Firestore transaction (idempotent)
    const newBalance = await db.runTransaction(async (tx) => {
      const paymentDoc = await tx.get(payRef);
      if (!paymentDoc.exists) {
        throw new Error('payment stub not found during transaction');
      }

      const paymentData = paymentDoc.data()!;
      
      // Double-check status (another request might have credited it)
      if (paymentData.status === 'CREDITED') {
        const userDoc = await tx.get(db.collection('users').doc(uid));
        return userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : 0;
      }

      // Atomically credit user balance
      const userRef = db.collection('users').doc(uid);
      tx.set(userRef, { createdAt: nowTs() }, { merge: true });
      tx.update(userRef, {
        balanceZAR: fv.increment(amountZAR),
        updatedAt: nowTs(),
      });

      // Mark payment as credited
      tx.set(payRef, {
        status: 'CREDITED',
        creditedAt: nowTs(),
      }, { merge: true });

      // Read new balance after increment
      const userDoc = await tx.get(userRef);
      return userDoc.exists ? (userDoc.data()?.balanceZAR ?? 0) : amountZAR;
    });

    console.log('[credit] ALLOW_PROVISIONAL=', process.env.ALLOW_PROVISIONAL, 'parsed=', ALLOW_PROVISIONAL, 'ref=', ref, 'uid=', uid, 'amount=', amountZAR, 'newBal=', newBalance);

    return res.status(200).json({
      ok: true,
      balance: newBalance,
    });
  } catch (err: any) {
    console.error('payfast:credit', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

