import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import crypto from 'crypto';
import { getPayFastBase } from '../_payfast.js';
import { storeLog } from '../_store.js';
import { db } from '../_firebaseAdmin.js';
import admin from 'firebase-admin';

const ORIGIN = 'https://brics-moz.vercel.app';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Diagnostic: Log every notify attempt (even if it fails validation)
  const logTs = Date.now();
  await storeLog(`payfast:log:${logTs}`, {
    path: '/api/payfast/notify',
    stage: 'start',
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
  });

  // Initialize inside handler (no top-level execution)
  const MODE = process.env.PAYFAST_MODE ?? 'live';
  const PF_BASE = getPayFastBase(MODE);

  const MID = process.env.PAYFAST_MERCHANT_ID ?? '';
  const PPHR = process.env.PAYFAST_PASSPHRASE ?? '';

  try {
    if (req.method !== 'POST') {
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'method_not_allowed',
        method: req.method,
      });
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Read raw body FIRST before any parsing (critical for signature verification)
    // PayFast sends form-encoded POST; we need the exact raw string as sent
    // In Vercel, req.body may already be parsed for form-encoded, so we need to check
    let rawBody: string;
    if (typeof req.body === 'string') {
      // Raw body string (ideal case)
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // Vercel parsed it - reconstruct preserving order if possible
      // Note: This fallback may not preserve exact order/encoding, but diagnostic logs will help
      rawBody = querystring.stringify(req.body as any);
      // Log warning that we're reconstructing (may affect signature)
      console.warn('payfast:notify', { context: 'body_reconstructed', note: 'Signature may fail if order/encoding differs' });
    } else {
      rawBody = '';
    }

    // Parse the raw body for field extraction
    const body = querystring.parse(rawBody);
    const params: Record<string, string> = Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [k, String(v ?? '')])
    );
    const rawData = params; // Keep for compatibility with rest of code

    // Extract received signature (case-insensitive)
    const receivedSignature = String(params.signature || '').toLowerCase();

    // Build signature base per PayFast spec:
    // 1. Exclude signature parameter
    // 2. Sort keys alphabetically
    // 3. Build key=value pairs with URL-encoded values (spaces as %20, not +)
    // 4. Append &passphrase=<encoded>
    const entries = Object.entries(params).filter(([k]) => k.toLowerCase() !== 'signature');
    const sortedKeys = entries.map(([k]) => k).sort();
    
    // Rebuild object in sorted order
    const sortedObj: Record<string, string> = {};
    for (const k of sortedKeys) {
      sortedObj[k] = String(params[k] ?? '');
    }

    // Construct signature base with URL-encoded values (encodeURIComponent uses %20 for spaces)
    let sigBase = sortedKeys
      .map((k) => `${k}=${encodeURIComponent(sortedObj[k])}`)
      .join('&');
    
    if (PPHR) {
      sigBase += `&passphrase=${encodeURIComponent(PPHR)}`;
    }

    // Compute MD5 hash
    const computedSignature = crypto.createHash('md5').update(sigBase).digest('hex').toLowerCase();
    
    // Compare signatures
    const match = computedSignature === receivedSignature;

    console.log('payfast:notify', { 
      ref: rawData.custom_str2 || rawData.m_payment_id || 'unknown', 
      match,
      sigBaseLength: sigBase.length,
      sortedKeysCount: sortedKeys.length
    });

    // 1) Basic merchant check
    if (rawData.merchant_id !== MID) {
      console.error('payfast:notify', { error: 'bad_merchant', merchant_id: rawData.merchant_id, context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_merchant',
        received_merchant_id: rawData.merchant_id,
        expected_merchant_id: MID,
        payload: rawData,
      });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad merchant' });
    }

    // 2) Signature verification (alphabetical sort + URL-encoding)
    if (!match) {
      console.error('payfast:notify', { error: 'bad_signature', context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_signature',
        computedSignature,
        receivedSignature,
        sortedKeys,
        sigBasePreview: sigBase.substring(0, 300), // Log first 300 chars for debugging
        payment_status: params.payment_status,
        pf_payment_id: params.pf_payment_id,
        m_payment_id: params.m_payment_id,
        payload: rawData,
      });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad signature' });
    }

    // 2) Validate with PayFast (recommended)
    try {
      const r = await fetch(`${PF_BASE}/eng/query/validate`, { 
        method: 'POST', 
        body: querystring.stringify(rawData), 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
      });
      const txt = (await r.text()).trim();
      if (txt !== 'VALID') {
        console.warn('payfast:notify', { validate_response: txt, context: 'payfast_validation' });
      }
    } catch (e: any) {
      console.warn('payfast:notify', { message: e?.message, context: 'payfast_validate_error' });
    }

    // 3) Handle status
    const status = rawData.payment_status || '';
    const ref = rawData.custom_str2 || rawData.m_payment_id || '';
    const userId = rawData.custom_str1 || '';
    const amountGross = rawData.amount_gross || rawData.amount || '';
    const payerEmail = rawData.email_address || rawData.payer_email || '';

    // Map PayFast status to our internal status
    type PaymentStatus = 'PENDING' | 'COMPLETE' | 'FAILED';
    let mappedStatus: PaymentStatus = 'PENDING';
    if (status === 'COMPLETE') {
      mappedStatus = 'COMPLETE';
    } else if (status === 'FAILED' || status === 'ABORTED') {
      mappedStatus = 'FAILED';
    }
    // Note: CANCELLED payments remain PENDING in our system

    console.log('[notify]', { ref, status: mappedStatus });

    // Update payments/{ref} with latest status and raw payload
    try {
      // Get uid from existing payment doc if it exists
      const payDoc = await db.collection('payments').doc(ref).get();
      const uid = payDoc.exists ? (payDoc.data()?.uid || userId) : userId;

      // Update payment with status, raw payload, and via field
      await db.collection('payments').doc(ref).set({
        status: mappedStatus,
        raw: rawData,
        via: 'notify',
      }, { merge: true });

      // Append ITN event log
      await db.collection('itn_events').add({
        ref,
        uid,
        type: 'notify',
        payload: rawData,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (updateErr: any) {
      console.error('[notify] failed to update payment', { ref, error: updateErr?.message });
      // Continue - don't fail the ITN response
    }

    // Diagnostic: Log successful validation and persistence outcome
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'verdict',
      verdict: 'accepted',
      reason: 'ok',
      receivedSignature,
      computedSignature,
      sortedKeys,
      sigBasePreview: sigBase.substring(0, 300),
      ref,
      status: mappedStatus,
      amount: amountGross,
      userId,
      payerEmail,
      payment_status: params.payment_status,
      pf_payment_id: params.pf_payment_id,
      m_payment_id: params.m_payment_id,
      payload: rawData,
    });

    return res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.error('payfast:notify', { message: err?.message, stack: err?.stack });
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'verdict',
      verdict: 'rejected',
      reason: 'exception',
      error: err?.message,
      stack: err?.stack,
    });
    cors(res);
    return res.status(500).json({ error: 'SERVER', detail: 'internal error' });
  }
}
