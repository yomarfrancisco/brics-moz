import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
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

function appendRef(url: string, ref: string): string {
  return url.includes('?') ? `${url}&ref=${encodeURIComponent(ref)}` : `${url}?ref=${encodeURIComponent(ref)}`;
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
  const MKEY = process.env.PAYFAST_MERCHANT_KEY ?? '';
  const RET = process.env.PAYFAST_RETURN_URL ?? '';
  const CAN = process.env.PAYFAST_CANCEL_URL ?? '';
  const NOTI = process.env.PAYFAST_NOTIFY_URL ?? '';
  const PPHR = process.env.PAYFAST_PASSPHRASE ?? '';

  try {
    cors(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Guard: check required envs
    const missing = [];
    if (!MID) missing.push('PAYFAST_MERCHANT_ID');
    if (!MKEY) missing.push('PAYFAST_MERCHANT_KEY');
    if (!RET) missing.push('PAYFAST_RETURN_URL');
    if (!CAN) missing.push('PAYFAST_CANCEL_URL');
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
      return res.status(400).json({ error: 'VALIDATION', detail: 'amount must be > 0' });
    }

    // Format amount to exactly 2 decimal places per PayFast spec
    const amount = amountNum.toFixed(2);

    // Generate reference
    const ref = crypto.randomUUID();

    // Build PayFast params (excluding empty values)
    const baseParams = prune({
      merchant_id: MID,
      merchant_key: MKEY,
      return_url: appendRef(RET, ref),
      cancel_url: CAN,
      notify_url: NOTI,
      amount: amount,
      item_name: 'BRICS Deposit',
      custom_str1: user_id, // will be pruned if empty
      custom_str2: ref,
    });

    // Sign AFTER pruning empty values
    const signature = signPayFastParams(baseParams, PPHR);

    // Build query string with signature
    const qs = new URLSearchParams({ ...baseParams, signature }).toString();
    const redirect_url = `${PF_BASE}/eng/process?${qs}`;

    return res.status(200).json({ redirect_url, ref });
  } catch (err: any) {
    console.error('payfast:create', { message: err?.message, stack: err?.stack });
    cors(res);
    return res.status(500).json({ error: 'SERVER', detail: 'internal error' });
  }
}
