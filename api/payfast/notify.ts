import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import { getPayFastBase, buildParamsAndSignature } from '../_payfast.js';
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

    // PayFast posts as form-encoded
    const body = typeof req.body === 'string' ? querystring.parse(req.body) : req.body as any;
    const rawData: Record<string, any> = Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [k, v ?? ''])
    );

    // Extract signature before verification
    const theirSig = (rawData.signature || '').toLowerCase();
    const { signature, ...forSig } = rawData;

    // 1) Basic checks
    if (forSig.merchant_id !== MID) {
      console.error('payfast:notify', { error: 'bad_merchant', merchant_id: forSig.merchant_id, context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_merchant',
        received_merchant_id: forSig.merchant_id,
        expected_merchant_id: MID,
        payload: rawData,
      });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad merchant' });
    }

    // Rebuild params using the same helper (excludes empty values automatically)
    const { signature: calcSig } = buildParamsAndSignature(forSig, PPHR);
    const match = theirSig === calcSig.toLowerCase();

    console.log('payfast:notify', { 
      ref: forSig.custom_str2 || forSig.m_payment_id || 'unknown', 
      match 
    });

    if (!match) {
      console.error('payfast:notify', { error: 'bad_signature', context: 'validation' });
      await storeLog(`payfast:log:${logTs}`, {
        stage: 'verdict',
        verdict: 'rejected',
        reason: 'bad_signature',
        computedSignature: calcSig.toLowerCase(),
        receivedSignature: theirSig,
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
