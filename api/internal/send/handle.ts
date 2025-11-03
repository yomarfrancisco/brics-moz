import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import crypto from 'crypto';

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
    const { toHandle, amountUSDT, memo, idempotencyKey } = body as {
      toHandle: string;
      amountUSDT: number;
      memo?: string;
      idempotencyKey?: string;
    };

    // Validate inputs
    if (!toHandle || typeof toHandle !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_toHandle' });
    }

    // Normalize handle: strip @ if present, lowercase
    const normalizedHandle = toHandle.startsWith('@') ? toHandle.slice(1).toLowerCase() : toHandle.toLowerCase();

    // Validate handle format: ^[a-z0-9_]{3,15}$
    if (!/^[a-z0-9_]{3,15}$/.test(normalizedHandle)) {
      return res.status(400).json({ ok: false, error: 'invalid_handle_format' });
    }

    if (!isFinite(amountUSDT) || amountUSDT <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' });
    }

    // Check idempotency if key provided
    if (idempotencyKey) {
      const idempotencyRef = db.collection('idempotency').doc(idempotencyKey);
      const idempotencyDoc = await idempotencyRef.get();
      
      if (idempotencyDoc.exists) {
        const data = idempotencyDoc.data()!;
        // Return the same result as before
        return res.status(200).json({
          ok: true,
          newSenderBalance: data.newSenderBalance,
          transferId: data.transferId,
          idempotent: true,
        });
      }
    }

    // 1) Resolve recipient handle OUTSIDE transaction
    const handleRef = db.collection('handles').doc(normalizedHandle);
    const handleDoc = await handleRef.get();
    
    if (!handleDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: 'handle_not_found',
        message: 'Handle not found. Try Send to Email or Phone.',
      });
    }

    const toUid = handleDoc.data()!.uid as string;

    if (!toUid) {
      return res.status(404).json({ ok: false, error: 'handle_no_uid' });
    }

    if (toUid === fromUid) {
      return res.status(400).json({
        ok: false,
        error: 'cannot_send_to_self',
        message: 'Cannot send to your own account.',
      });
    }

    // 2) Transaction: ALL READS FIRST, THEN WRITES
    let transferId: string;
    let newSenderBalance: number;

    await db.runTransaction(async (tx) => {
      const usersCol = db.collection('users');
      const fromRef = usersCol.doc(fromUid);
      const toRef = usersCol.doc(toUid);

      // Read both user docs
      const fromDoc = await tx.get(fromRef);
      const toDoc = await tx.get(toRef);

      if (!fromDoc.exists) {
        throw new Error('sender_not_found');
      }

      if (!toDoc.exists) {
        throw new Error('recipient_not_found');
      }

      const fromData = fromDoc.data()!;
      const toData = toDoc.data()!;

      // Read balances
      const fromBalUSDT = Number(fromData.balances?.USDT ?? fromData.balanceUSDT ?? 0);
      const fromBalZAR = Number(fromData.balances?.ZAR ?? fromData.balanceZAR ?? fromData.balance ?? fromBalUSDT);
      const toBalUSDT = Number(toData.balances?.USDT ?? toData.balanceUSDT ?? 0);
      const toBalZAR = Number(toData.balances?.ZAR ?? toData.balanceZAR ?? toData.balance ?? toBalUSDT);

      // Validate balance
      if (fromBalUSDT < amountUSDT) {
        throw new Error('insufficient_funds');
      }

      // All reads done, now writes
      transferId = db.collection('transfers').doc().id;
      const transferRef = db.collection('transfers').doc(transferId);

      newSenderBalance = fromBalUSDT - amountUSDT;

      // Write transfer
      tx.set(transferRef, {
        type: 'internal_handle',
        fromUid,
        toUid,
        toHandle: normalizedHandle,
        amountUSDT,
        memo: memo || null,
        status: 'SETTLED',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Debit sender (canonical + mirrors)
      tx.update(fromRef, {
        'balances.USDT': newSenderBalance,
        'balances.ZAR': fromBalZAR - amountUSDT, // mirror 1:1 until FX
        // Legacy mirrors (temporary)
        balanceUSDT: newSenderBalance,
        balanceZAR: fromBalZAR - amountUSDT,
        balance: fromBalZAR - amountUSDT,
      });

      // Credit recipient (canonical + mirrors)
      tx.update(toRef, {
        'balances.USDT': toBalUSDT + amountUSDT,
        'balances.ZAR': toBalZAR + amountUSDT, // mirror 1:1 until FX
        // Legacy mirrors (temporary)
        balanceUSDT: toBalUSDT + amountUSDT,
        balanceZAR: toBalZAR + amountUSDT,
        balance: toBalZAR + amountUSDT,
      });

      // Store idempotency key if provided
      if (idempotencyKey) {
        const idempotencyRef = db.collection('idempotency').doc(idempotencyKey);
        tx.set(idempotencyRef, {
          transferId,
          newSenderBalance,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    return res.status(200).json({
      ok: true,
      newSenderBalance,
      transferId,
    });
  } catch (e: any) {
    console.error('[send/handle] error:', e);
    
    if (e.message === 'insufficient_funds') {
      return res.status(400).json({
        ok: false,
        error: 'insufficient_funds',
      });
    }
    
    if (e.message === 'sender_not_found' || e.message === 'recipient_not_found') {
      return res.status(404).json({
        ok: false,
        error: e.message,
      });
    }

    // Surface Firestore transaction constraint errors
    if (String(e?.message || '').includes('all reads')) {
      return res.status(400).json({
        ok: false,
        error: 'txn_reads_before_writes',
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

