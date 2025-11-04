import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { db } from '../../_firebaseAdmin.js';
import { randHex } from '../../../src/lib/random';

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

    // 1) Normalize & resolve recipient OUTSIDE the transaction
    // This avoids "all reads before writes" constraint violations
    let toUid: string | null = null;
    if (to.type === 'email') {
      const emailLower = normalized;
      const snap = await db.collection('users')
        .where('emailLower', '==', emailLower)
        .limit(1)
        .get();
      if (!snap.empty) {
        toUid = snap.docs[0].id;
      }
    } else {
      // Phone lookup
      const phoneE164 = normalized;
      const snap = await db.collection('users')
        .where('phoneE164', '==', phoneE164)
        .limit(1)
        .get();
      if (!snap.empty) {
        toUid = snap.docs[0].id;
      }
    }

    // Generate invite code outside transaction if needed (for invite flow)
    const inviteCode = toUid ? null : randHex(8);

    let resp: any = null;

    // 2) Transaction: ALL READS FIRST, THEN WRITES
    await db.runTransaction(async (tx: Transaction) => {
      const usersCol = db.collection('users');
      const fromRef = usersCol.doc(fromUid);
      const fromDoc = await tx.get(fromRef);

      if (!fromDoc.exists) {
        throw new Error('sender_not_found');
      }

      const fromData = fromDoc.data()!;
      
      // Read from canonical balances structure
      const balUSDT = Number(fromData.balances?.USDT ?? fromData.balanceUSDT ?? 0);
      const balZAR = Number(fromData.balances?.ZAR ?? fromData.balanceZAR ?? fromData.balance ?? balUSDT);
      
      // Diagnostic log before validation
      console.log('SEND_INIT balance snapshot', {
        uid: fromUid,
        usdtBefore: balUSDT,
        amount: amountUSDT,
        toType: to.type,
      });

      // Validate amount
      if (!isFinite(amountUSDT) || amountUSDT <= 0) {
        throw new Error('invalid_amount');
      }
      if (balUSDT < amountUSDT) {
        throw new Error('insufficient_balance');
      }

      // Optional recipient read (still before any write)
      let toRef: DocumentReference | null = null;
      let toDoc: DocumentSnapshot | null = null;
      if (toUid) {
        toRef = usersCol.doc(toUid);
        toDoc = await tx.get(toRef);
        if (!toDoc.exists) {
          throw new Error('recipient_missing_after_lookup');
        }
      }

      // Now perform writes (all reads are done)
      const transferId = db.collection('transfers').doc().id;
      const transferRef = db.collection('transfers').doc(transferId);

      // Record transfer (write after all reads)
      const transferData: any = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fromUid,
        toUid: toUid ?? null,
        to: toPayload,
        amountUSDT,
        status: toUid ? 'SETTLED' : 'PENDING',
        memo: memo || null,
      };
      
      if (inviteCode) {
        transferData.inviteCode = inviteCode;
      }
      
      tx.set(transferRef, transferData);

      // Debit sender (canonical + mirrors)
      tx.update(fromRef, {
        'balances.USDT': balUSDT - amountUSDT,
        'balances.ZAR': balZAR - amountUSDT, // mirror 1:1 until FX
        // Legacy mirrors (temporary)
        balanceUSDT: balUSDT - amountUSDT,
        balanceZAR: balZAR - amountUSDT,
        balance: balZAR - amountUSDT,
      });

      if (toUid && toRef && toDoc) {
        // Credit recipient (canonical + mirrors)
        const toData = toDoc.data()!;
        const toBalUSDT = Number(toData.balances?.USDT ?? toData.balanceUSDT ?? 0);
        const toBalZAR = Number(toData.balances?.ZAR ?? toData.balanceZAR ?? toData.balance ?? toBalUSDT);

        tx.update(toRef, {
          'balances.USDT': toBalUSDT + amountUSDT,
          'balances.ZAR': toBalZAR + amountUSDT, // mirror 1:1 until FX
          // Legacy mirrors (temporary)
          balanceUSDT: toBalUSDT + amountUSDT,
          balanceZAR: toBalZAR + amountUSDT,
          balance: toBalZAR + amountUSDT,
        });

        resp = {
          ok: true,
          mode: 'settled',
          transferId,
          newSenderBalance: balUSDT - amountUSDT,
        };
      } else {
        // Create invite (safe after reads, inviteCode already generated outside tx)
        const inviteRef = db.collection('invites').doc(inviteCode!);

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
          newSenderBalance: balUSDT - amountUSDT,
        };
      }
    });

    return res.status(200).json(resp);
  } catch (e: any) {
    console.error('[send/init] error:', e);
    
    // Surface Firestore transaction constraint errors clearly
    if (String(e?.message || '').includes('all reads')) {
      return res.status(400).json({
        ok: false,
        error: 'txn_reads_before_writes',
        detail: 'Transaction violated Firestore "all reads before writes" constraint',
      });
    }
    
    return res.status(400).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

