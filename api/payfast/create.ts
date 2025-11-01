import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getPayFastBase, signPayFastParams } from '../_payfast';

const MODE = process.env.PAYFAST_MODE || 'live';
const PF_BASE = getPayFastBase(MODE);

// Required envs
const MID  = process.env.PAYFAST_MERCHANT_ID || '';
const MKEY = process.env.PAYFAST_MERCHANT_KEY || '';
const RET  = process.env.PAYFAST_RETURN_URL || '';
const CAN  = process.env.PAYFAST_CANCEL_URL || '';
const NOTI = process.env.PAYFAST_NOTIFY_URL || '';
const PPHR = process.env.PAYFAST_PASSPHRASE || '';

function twoDp(n: number) {
  // PayFast expects fixed 2 decimal places
  return (Math.round(n * 100) / 100).toFixed(2);
}

function allowCORS(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://brics-moz.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Guard: check envs
  const missing = [];
  if (!MID)  missing.push('PAYFAST_MERCHANT_ID');
  if (!MKEY) missing.push('PAYFAST_MERCHANT_KEY');
  if (!RET)  missing.push('PAYFAST_RETURN_URL');
  if (!CAN)  missing.push('PAYFAST_CANCEL_URL');
  if (!NOTI) missing.push('PAYFAST_NOTIFY_URL');
  if (missing.length) {
    return res.status(400).json({ error: 'config_missing', detail: missing });
  }

  try {
    // Parse body for both JSON and form-encoded
    let amountRaw: any;
    let user_id: any;
    let email: any;
    let name_first: any;
    let name_last: any;

    if (req.headers['content-type']?.includes('application/json')) {
      ({ amount: amountRaw, user_id, email, name_first, name_last } = (req.body ?? {}));
    } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const body = req.body as any; // Vercel parses to object
      amountRaw = body.amount;
      user_id   = body.user_id;
      email     = body.email;
      name_first = body.name_first;
      name_last  = body.name_last;
    } else {
      // try fallback
      ({ amount: amountRaw, user_id, email, name_first, name_last } = (req.body ?? {}));
    }

    const amountNum = Number(amountRaw);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'bad_request', detail: 'amount must be a positive number' });
    }

    const ref = crypto.randomUUID(); // our internal ref

    const params: Record<string, string> = {
      merchant_id: MID,
      merchant_key: MKEY,
      // PayFast fields
      amount: twoDp(amountNum),
      item_name: 'BRICS Deposit',
      return_url: RET.includes('?') ? `${RET}&ref=${ref}` : `${RET}?ref=${ref}`,
      cancel_url: CAN,
      notify_url: NOTI,
      // references for reconciliation
      m_payment_id: ref,        // merchant-side reference
      custom_str1: user_id || '', // optional user link
    };

    if (email) params['email_address'] = String(email);
    if (name_first) params['name_first'] = String(name_first);
    if (name_last) params['name_last'] = String(name_last);

    // Sign
    params.signature = signPayFastParams(params, PPHR);

    const search = new URLSearchParams(params);
    const redirect_url = `${PF_BASE}/eng/process?${search.toString()}`;

    return res.status(200).json({ redirect_url, ref });
  } catch (err: any) {
    console.error('[payfast/create] error', { message: err?.message, stack: err?.stack });
    return res.status(400).json({ error: 'create_failed', detail: err?.message || 'unknown' });
  }
}
