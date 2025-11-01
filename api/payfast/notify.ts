import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import crypto from 'crypto';
import { getPayFastBase } from '../_payfast.js';
import { storeSet, storeEnabled, storeLog } from '../_store.js';

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

    // Parse the raw body for field extraction (after signature verification)
    const body = querystring.parse(rawBody);
    const rawData: Record<string, any> = Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [k, v ?? ''])
    );

    // Extract signature from raw body string (case-insensitive match)
    const pairs = rawBody.split('&');
    const receivedSigPair = pairs.find(p => p.toLowerCase().startsWith('signature='));
    const receivedSig = (receivedSigPair || '').split('=').slice(1).join('=') || ''; // Handle values with '='
    
    // Build signature base: remove signature pair, keep everything else as-is
    const basePairs = pairs.filter(p => !p.toLowerCase().startsWith('signature='));
    let sigBase = basePairs.join('&');
    if (PPHR) {
      sigBase += `&passphrase=${encodeURIComponent(PPHR)}`;
    }
    
    // Compute signature from raw string (exactly as PayFast does)
    const computedSig = crypto.createHash('md5').update(sigBase).digest('hex').toLowerCase();
    const receivedSigLower = receivedSig.toLowerCase();
    const match = computedSig === receivedSigLower;

    console.log('payfast:notify', { 
      ref: rawData.custom_str2 || rawData.m_payment_id || 'unknown', 
      match,
      sigBaseLength: sigBase.length
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

    // 2) Signature verification (using raw body approach)
    if (!match) {
      console.error('payfast:notify', { error: 'bad_signature', context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_signature',
        computedSignature: computedSig,
        receivedSignature: receivedSigLower,
        sigBase: sigBase.substring(0, 200), // Log first 200 chars for debugging
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

    // Map PayFast status to our status
    let mappedStatus: 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'PENDING' = 'PENDING';
    if (status === 'COMPLETE') {
      mappedStatus = 'COMPLETE';
    } else if (status === 'CANCELLED') {
      mappedStatus = 'CANCELLED';
    } else if (status === 'FAILED' || status === 'ABORTED') {
      mappedStatus = 'FAILED';
    }

    console.info('payfast:notify', { status, ref, userId, amount: amountGross, context: 'itn_received' });

    // Store status in Upstash Redis
    let storeResult: 'success' | 'failed' | 'disabled' = 'disabled';
    if (storeEnabled()) {
      try {
        await storeSet(ref, {
          status: mappedStatus,
          amount_gross: amountGross,
          payer_email: payerEmail,
          updated_at: Date.now(),
          raw: rawData
        });
        storeResult = 'success';
      } catch (e: any) {
        console.error('payfast:notify', { message: e?.message, stack: e?.stack, context: 'store_error' });
        storeResult = 'failed';
      }
    } else {
      console.warn('payfast:notify', { context: 'STORE_DISABLED: ITN not persisted' });
    }

    // Diagnostic: Log successful validation and persistence outcome
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'verdict',
      verdict: 'accepted',
      ref,
      status: mappedStatus,
      amount: amountGross,
      userId,
      payerEmail,
      storeResult,
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
