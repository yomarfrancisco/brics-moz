export const runtime = 'nodejs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getPayFastBase, buildParamsAndSignature } from '../_payfast.js';
import { db } from '../_firebaseAdmin.js';
import admin from 'firebase-admin';

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
    const user_id = body?.user_id || '';
    const amount_zar = Number(body?.amount_zar || body?.amount || 0);

    if (!user_id || user_id.trim() === '') {
      return res.status(400).json({ error: 'user_id_required' });
    }

    if (!Number.isFinite(amount_zar) || amount_zar <= 0) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'amount_zar must be > 0' });
    }

    const ref = crypto.randomUUID();
    const amount = amount_zar.toFixed(2); // PayFast requires 2dp

    // Build PayFast redirect URL
    const rawParams: Record<string, string | undefined> = {
      merchant_id: MI,
      merchant_key: MK,
      return_url: appendRef(`${APP_BASE_URL}/balance`, ref),
      cancel_url: `${APP_BASE_URL}/balance?canceled=1`,
      notify_url: NOTIFY_URL,
      amount,
      item_name: 'BRICS Deposit',
      custom_str1: user_id,
      custom_str2: ref
    };

    const { params, signature } = buildParamsAndSignature(rawParams, PPHR);
    params.append('signature', signature);

    const PF_BASE = getPayFastBase(MODE);
    const redirect_url = `${PF_BASE}/eng/process?${params.toString()}`;

    // Build return URLs with ref parameter
    const returnUrl = appendRef(`${APP_BASE_URL}/balance`, ref);
    const cancelUrl = `${APP_BASE_URL}/balance?canceled=1&ref=${encodeURIComponent(ref)}`;

    // Write payment stub to Firestore
    await db.collection('payments').doc(ref).set({
      ref,
      uid: user_id,
      amountZAR: amount_zar,
      status: 'PENDING',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      via: 'create',
    });

    console.log('[create]', { ref, uid: user_id, amountZAR: amount_zar });

    return res.status(200).json({ ok: true, ref, redirect_url, return_url: returnUrl });
  } catch (e: any) {
    console.error('payfast:create', e?.message, e?.stack);
    cors(res);
    return res.status(500).json({ error: 'SERVER' });
  }
}
