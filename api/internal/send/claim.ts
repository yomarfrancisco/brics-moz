import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const code = (req.query.code as string) || '';
    
    if (!code) {
      return res.status(400).json({ ok: false, error: 'missing_code' });
    }

    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const emailLower = decoded.email?.toLowerCase();

    let resp: any = null;

    await db.runTransaction(async (tx) => {
      const inviteRef = db.collection('invites').doc(code);
      const inviteSnap = await tx.get(inviteRef);
      
      if (!inviteSnap.exists) {
        throw new Error('invite_not_found');
      }

      const invite = inviteSnap.data()!;

      if (invite.status !== 'PENDING') {
        resp = { ok: true, already: true, transferId: invite.transferId };
        return;
      }

      // Only email claims supported initially
      if (invite.to?.type !== 'email') {
        throw new Error('phone_claim_not_supported_yet');
      }

      if (!emailLower || emailLower !== invite.to.normalized) {
        throw new Error('email_mismatch');
      }

      const transferRef = db.collection('transfers').doc(invite.transferId);
      const transferSnap = await tx.get(transferRef);
      
      if (!transferSnap.exists) {
        throw new Error('transfer_not_found');
      }

      const t = transferSnap.data()!;

      if (t.status !== 'PENDING') {
        resp = { ok: true, already: true, transferId: invite.transferId };
        return;
      }

      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : {};
      
      // Read from canonical balances structure
      const curUSDT = Number(userData?.balances?.USDT ?? userData?.balanceUSDT ?? 0);
      const curZAR = Number(userData?.balances?.ZAR ?? userData?.balanceZAR ?? userData?.balance ?? curUSDT);
      const creditAmount = Number(invite.amountUSDT || 0);

      // Credit to canonical balances structure + legacy mirrors
      tx.update(userRef, {
        'balances.USDT': curUSDT + creditAmount,
        'balances.ZAR': curZAR + creditAmount, // mirror 1:1 until FX
        // Legacy mirrors (temporary)
        balanceUSDT: curUSDT + creditAmount,
        balanceZAR: curZAR + creditAmount,
        balance: curZAR + creditAmount,
        emailLower: emailLower || null,
      });

      tx.update(transferRef, {
        status: 'SETTLED',
        toUid: uid,
      });

      tx.update(inviteRef, {
        status: 'CLAIMED',
        recipientUid: uid,
      });

      resp = {
        ok: true,
        transferId: invite.transferId,
        newBalance: curUSDT + creditAmount, // return USDT balance
      };
    });

    return res.status(200).json(resp);
  } catch (e: any) {
    console.error('[send/claim] error:', e);
    return res.status(400).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

