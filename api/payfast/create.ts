import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getPayFastBase, buildParamsAndSignature } from '../_payfast.js';
import { db, fv, nowTs } from '../_firebase.js';

const ORIGIN = 'https://brics-moz.vercel.app';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function appendRef(url: string, ref: string): string {
  const u = new URL(url);
  u.searchParams.set('ref', ref);
  return u.toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD' });

  try {
    const MODE = process.env.PAYFAST_MODE || 'live';
    const MI = process.env.PAYFAST_MERCHANT_ID;
    const MK = process.env.PAYFAST_MERCHANT_KEY;
    const APP_BASE_URL = process.env.APP_BASE_URL || 'https://brics-moz.vercel.app';
    const NOTIFY_URL = process.env.PAYFAST_NOTIFY_URL;
    const PPHR = process.env.PAYFAST_PASSPHRASE;

    if (!MI || !MK || !NOTIFY_URL) {
      return res.status(500).json({ error: 'CONFIG', detail: 'Missing PayFast env vars' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const amtNum = Number(body?.amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'amount must be > 0' });
    }
    const userId = body?.user_id || '';
    if (!userId || userId.trim() === '') {
      return res.status(400).json({ error: 'VALIDATION', detail: 'user_id is required' });
    }
    const amount = amtNum.toFixed(2); // PayFast requires 2dp
    const ref = crypto.randomUUID();

    // Raw values (not pre-encoded). We'll encode exactly once below.
    const rawParams: Record<string, string | undefined> = {
      merchant_id: MI,
      merchant_key: MK,
      return_url: appendRef(`${APP_BASE_URL}/balance`, ref),
      cancel_url: `${APP_BASE_URL}/balance?canceled=1`,
      notify_url: NOTIFY_URL,
      amount,
      item_name: 'BRICS Deposit',
      custom_str1: body?.user_id, // omitted if empty
      custom_str2: ref
    };

    const { params, signature } = buildParamsAndSignature(rawParams, PPHR);
    params.append('signature', signature);

    const PF_BASE = getPayFastBase(MODE);
    const redirect_url = `${PF_BASE}/eng/process?${params.toString()}`;

    // Ensure user doc exists and create payment stub in Firestore
    try {
      // Ensure user doc exists (initialize if needed)
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        await userRef.set({
          balanceZAR: 0,
          createdAt: nowTs(),
          updatedAt: nowTs(),
        });
      } else {
        // Just update updatedAt if doc exists
        await userRef.set({ updatedAt: nowTs() }, { merge: true });
      }

      // Create payment stub
      await db.collection('payments').doc(ref).set({
        ref,
        uid: userId,
        amountZAR: amtNum,
        status: 'PENDING',
        createdAt: nowTs(),
      }, { merge: true });

      console.log('[create] payment stub written to Firestore', { ref, uid: userId, amountZAR: amtNum });
    } catch (firestoreErr: any) {
      // Don't fail the request if Firestore write fails, but log it
      console.error('payfast:create firestore write failed', { ref, error: firestoreErr?.message });
    }

    console.log('payfast:create ok', { ref, len: params.toString().length });

    return res.status(200).json({ redirect_url, ref });
  } catch (e: any) {
    console.error('payfast:create', e?.message, e?.stack);
    cors(res);
    return res.status(500).json({ error: 'SERVER' });
  }
}
