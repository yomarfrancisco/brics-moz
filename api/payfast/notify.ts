import type { VercelRequest, VercelResponse } from '@vercel/node';
import querystring from 'querystring';
import { getPayFastBase, signPayFastParams } from '../_payfast';

const MODE = process.env.PAYFAST_MODE || 'live';
const PF_BASE = getPayFastBase(MODE);

const MID = process.env.PAYFAST_MERCHANT_ID!;
const PPHR = process.env.PAYFAST_PASSPHRASE || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // PayFast posts as form-encoded
  const body = typeof req.body === 'string' ? querystring.parse(req.body) : req.body as any;
  const data: Record<string, string> = Object.fromEntries(Object.entries(body || {}).map(([k, v]) => [k, String(v ?? '')]));

  // 1) Basic checks
  if (data.merchant_id !== MID) return res.status(400).send('bad merchant');

  const theirSig = (data.signature || '').toLowerCase();
  const { signature, ...forSig } = data;
  const calcSig = signPayFastParams(forSig, PPHR).toLowerCase();
  if (theirSig !== calcSig) return res.status(400).send('bad signature');

  // 2) Validate with PayFast (recommended)
  try {
    const r = await fetch(`${PF_BASE}/eng/query/validate`, { method: 'POST', body: querystring.stringify(data), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const txt = (await r.text()).trim();
    if (txt !== 'VALID') console.warn('[payfast] validate:', txt);
  } catch (e) {
    console.warn('[payfast] validate error', e);
  }

  // 3) Handle status
  const status = data.payment_status;
  const ref = data.custom_str1;
  const userId = data.custom_str2;
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

  console.info('[payfast] ITN', { status, ref, userId, amount: amountGross });

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
    } catch (e) {
      console.error('[payfast] KV store error:', e);
    }
  } else {
    console.info('[payfast] ITN received (KV not configured) – status will not persist');
  }

  return res.status(200).send('OK');
}

