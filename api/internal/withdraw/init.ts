import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';

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
    const uid = decoded.uid;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { amountUSDT, bankName, accountType, branchCode, accountNumber, accountHolder, country } = body as {
      amountUSDT: number;
      bankName: string;
      accountType: string;
      branchCode: string;
      accountNumber: string;
      accountHolder: string;
      country: string;
    };

    // Validate payload
    if (!isFinite(amountUSDT) || amountUSDT <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' });
    }

    if (!bankName || typeof bankName !== 'string' || bankName.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_bank_name' });
    }

    if (!accountType || typeof accountType !== 'string' || accountType.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_account_type' });
    }

    if (!branchCode || typeof branchCode !== 'string' || branchCode.length < 3 || branchCode.length > 8) {
      return res.status(400).json({ ok: false, error: 'invalid_branch_code' });
    }

    if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.length < 6 || accountNumber.length > 16) {
      return res.status(400).json({ ok: false, error: 'invalid_account_number' });
    }

    if (!accountHolder || typeof accountHolder !== 'string' || accountHolder.length < 2) {
      return res.status(400).json({ ok: false, error: 'invalid_account_holder' });
    }

    if (!country || (country !== 'ZA' && country !== 'MZ')) {
      return res.status(400).json({ ok: false, error: 'invalid_country' });
    }

    let withdrawalId: string;
    let newBalanceUSDT: number;

    // Transaction: read user, validate balance, debit, create withdrawal record
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        throw new Error('user_not_found');
      }

      const userData = userDoc.data()!;
      
      // Read from canonical balances structure
      const balUSDT = Number(userData.balances?.USDT ?? userData.balanceUSDT ?? 0);
      const balZAR = Number(userData.balances?.ZAR ?? userData.balanceZAR ?? userData.balance ?? balUSDT);

      // Validate balance
      if (balUSDT < amountUSDT) {
        throw new Error('insufficient_funds');
      }

      // All reads done, now writes
      withdrawalId = db.collection('withdrawals').doc().id;
      const withdrawalRef = db.collection('withdrawals').doc(withdrawalId);

      newBalanceUSDT = balUSDT - amountUSDT;

      // Create withdrawal record
      tx.set(withdrawalRef, {
        id: withdrawalId,
        uid,
        amountUSDT,
        bankName,
        accountType,
        branchCode,
        accountNumber,
        accountHolder,
        country,
        status: 'PENDING',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Debit user balance (canonical + mirrors)
      tx.update(userRef, {
        'balances.USDT': newBalanceUSDT,
        'balances.ZAR': balZAR - amountUSDT, // mirror 1:1 until FX
        // Legacy mirrors (temporary)
        balanceUSDT: newBalanceUSDT,
        balanceZAR: balZAR - amountUSDT,
        balance: balZAR - amountUSDT,
      });
    });

    return res.status(200).json({
      ok: true,
      id: withdrawalId,
      newBalanceUSDT,
    });
  } catch (e: any) {
    console.error('[withdraw/init] error:', e);
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

