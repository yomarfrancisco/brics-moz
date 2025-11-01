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

function allowCORS(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://brics-moz.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCORS(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // Guard: check required envs
    const missing = [];
    if (!MID)  missing.push('PAYFAST_MERCHANT_ID');
    if (!MKEY) missing.push('PAYFAST_MERCHANT_KEY');
    if (!RET)  missing.push('PAYFAST_RETURN_URL');
    if (!CAN)  missing.push('PAYFAST_CANCEL_URL');
    if (!NOTI) missing.push('PAYFAST_NOTIFY_URL');
    if (missing.length) {
      console.error('payfast:create', { error: 'CONFIG', missing, context: 'env_validation' });
      return res.status(500).json({ error: 'CONFIG', detail: `Missing: ${missing.join(', ')}` });
    }

    // Parse body for both JSON and form-encoded
    let amountRaw: any;
    let user_id: any;

    if (req.headers['content-type']?.includes('application/json')) {
      ({ amount: amountRaw, user_id } = (req.body ?? {}));
    } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const body = req.body as any;
      amountRaw = body.amount;
      user_id = body.user_id;
    } else {
      // fallback: try req.body
      ({ amount: amountRaw, user_id } = (req.body ?? {}));
    }

    // Validate input: amount must be a finite positive number
    const amountNum = Number(amountRaw);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'amount must be a positive number' });
    }

    // Format amount to exactly 2 decimal places per PayFast spec
    const amount = amountNum.toFixed(2);

    // Generate reference
    const ref = crypto.randomUUID();

    // Build PayFast params exactly per spec
    const params: Record<string, string> = {
      merchant_id: MID,
      merchant_key: MKEY,
      return_url: RET.includes('?') ? `${RET}&ref=${encodeURIComponent(ref)}` : `${RET}?ref=${encodeURIComponent(ref)}`,
      cancel_url: CAN,
      notify_url: NOTI,
      amount: amount,
      item_name: 'BRICS Deposit',
      custom_str1: user_id || '',
      custom_str2: ref,
    };

    // Sign with passphrase if present
    params.signature = signPayFastParams(params, PPHR);

    // Build redirect URL
    const search = new URLSearchParams(params);
    const redirect_url = `${PF_BASE}/eng/process?${search.toString()}`;

    return res.status(200).json({ redirect_url, ref });
  } catch (err: any) {
    console.error('payfast:create', { 
      message: err?.message, 
      stack: err?.stack, 
      context: 'handler_error' 
    });
    return res.status(500).json({ error: 'SERVER_ERROR', detail: err?.message || 'unknown error' });
  }
}
