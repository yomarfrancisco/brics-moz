import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import crypto from 'crypto';

function normEmail(v: string): string {
  return v.trim().toLowerCase();
}

function normPhone(v: string): string {
  return v.replace(/\s+/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const fromUid = decoded.uid;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, amountUSDT, memo } = body as {
      to: { type: 'email' | 'phone'; value: string };
      amountUSDT: number;
      memo?: string;
    };

    if (!to?.type || !to?.value) {
      return res.status(400).json({ ok: false, error: 'invalid_to' });
    }

    if (!(amountUSDT > 0)) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' });
    }

    const normalized = to.type === 'email' ? normEmail(to.value) : normPhone(to.value);
    const toPayload = { ...to, normalized };

    let resp: any = null;

    await db.runTransaction(async (tx) => {
      const fromRef = db.collection('users').doc(fromUid);
      const fromSnap = await tx.get(fromRef);
      
      if (!fromSnap.exists) {
        throw new Error('sender_not_found');
      }

      const from = fromSnap.data()!;
      const bal = Number(from.balanceUSDT || 0);

      if (bal < amountUSDT) {
        throw new Error('insufficient_balance');
      }

      // Find recipient by normalized email/phone
      let toUid: string | undefined;

      if (to.type === 'email') {
        const q = await tx.get(
          db.collection('users').where('emailLower', '==', normalized).limit(1)
        );
        if (!q.empty) {
          toUid = q.docs[0].id;
        }
      } else {
        const q = await tx.get(
          db.collection('users').where('phoneE164', '==', normalized).limit(1)
        );
        if (!q.empty) {
          toUid = q.docs[0].id;
        }
      }

      // Reserve debit
      tx.update(fromRef, { balanceUSDT: bal - amountUSDT });

      const transferId = db.collection('transfers').doc().id;
      const transferRef = db.collection('transfers').doc(transferId);

      if (toUid) {
        // Settle internal transfer
        const toRef = db.collection('users').doc(toUid);
        const toSnap = await tx.get(toRef);
        const toBal = Number(toSnap.data()?.balanceUSDT || 0);

        tx.update(toRef, { balanceUSDT: toBal + amountUSDT });

        tx.set(transferRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          fromUid,
          toUid,
          to: toPayload,
          amountUSDT,
          status: 'SETTLED',
          memo: memo || null,
        });

        resp = {
          ok: true,
          mode: 'settled',
          transferId,
          newSenderBalance: bal - amountUSDT,
        };
      } else {
        // Create invite
        const inviteCode = crypto.randomBytes(8).toString('hex');
        const inviteRef = db.collection('invites').doc(inviteCode);

        tx.set(transferRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          fromUid,
          to: toPayload,
          amountUSDT,
          status: 'PENDING',
          inviteCode,
          memo: memo || null,
        });

        tx.set(inviteRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          fromUid,
          to: toPayload,
          amountUSDT,
          status: 'PENDING',
          transferId,
          memo: memo || null,
        });

        const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.BASE_URL || 'https://brics-moz.vercel.app');
        const claimUrl = `${base}/claim?code=${inviteCode}`;

        resp = {
          ok: true,
          mode: 'pending',
          transferId,
          inviteCode,
          claimUrl,
          newSenderBalance: bal - amountUSDT,
        };
      }
    });

    return res.status(200).json(resp);
  } catch (e: any) {
    console.error('[send/init] error:', e);
    return res.status(400).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

