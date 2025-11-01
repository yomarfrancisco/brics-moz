import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import { getPayFastBase, signPayFastParams } from '../_payfast.js';

const ORIGIN = 'https://brics-moz.vercel.app';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function prune<T extends Record<string, any>>(o: T): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== '' && v !== null && v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  // Initialize inside handler (no top-level execution)
  const MODE = process.env.PAYFAST_MODE ?? 'live';
  const PF_BASE = getPayFastBase(MODE);

  const MID = process.env.PAYFAST_MERCHANT_ID ?? '';
  const PPHR = process.env.PAYFAST_PASSPHRASE ?? '';

  try {
    cors(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // PayFast posts as form-encoded
    const body = typeof req.body === 'string' ? querystring.parse(req.body) : req.body as any;
    const rawData: Record<string, any> = Object.fromEntries(
      Object.entries(body || {}).map(([k, v]) => [k, v ?? ''])
    );

    // Prune empty values before validation
    const data = prune(rawData);

    // 1) Basic checks
    if (data.merchant_id !== MID) {
      console.error('payfast:notify', { error: 'bad_merchant', merchant_id: data.merchant_id, context: 'validation' });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad merchant' });
    }

    // Extract signature before computing ours
    const theirSig = (data.signature || '').toLowerCase();
    const { signature, ...forSig } = data;
    
    // Prune empty values from signature calculation
    const forSigPruned = prune(forSig);
    const calcSig = signPayFastParams(forSigPruned, PPHR).toLowerCase();
    
    if (theirSig !== calcSig) {
      console.error('payfast:notify', { error: 'bad_signature', context: 'validation' });
      return res.status(400).json({ error: 'VALIDATION', detail: 'bad signature' });
    }

    // 2) Validate with PayFast (recommended)
    try {
      const r = await fetch(`${PF_BASE}/eng/query/validate`, { 
        method: 'POST', 
        body: querystring.stringify(data), 
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
    const status = data.payment_status || '';
    const ref = data.custom_str2 || data.m_payment_id || '';
    const userId = data.custom_str1 || '';
    const amountGross = data.amount_gross || data.amount || '';
    const payerEmail = data.email_address || data.payer_email || '';

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

    // (Optional) If Vercel KV exists, store status by ref with payfast: prefix
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const kvKey = `payfast:${ref}`;
        await fetch(`${process.env.KV_REST_API_URL}/set/${kvKey}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: mappedStatus,
            amount: amountGross,
            payer_email: payerEmail,
            raw: data,
            ts: Date.now()
          })
        });
      } catch (e: any) {
        console.error('payfast:notify', { message: e?.message, stack: e?.stack, context: 'kv_store_error' });
      }
    } else {
      console.info('payfast:notify', { context: 'kv_not_configured' });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.error('payfast:notify', { message: err?.message, stack: err?.stack });
    cors(res);
    return res.status(500).json({ error: 'SERVER', detail: 'internal error' });
  }
}
