import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getPayFastBase, signPayFastParams } from '../_payfast';

const MODE = process.env.PAYFAST_MODE || 'live';
const PF_BASE = getPayFastBase(MODE);

const MID = process.env.PAYFAST_MERCHANT_ID!;
const MKEY = process.env.PAYFAST_MERCHANT_KEY!;
const PPHR = process.env.PAYFAST_PASSPHRASE || '';
const RETURN_URL = process.env.PAYFAST_RETURN_URL!;
const CANCEL_URL = process.env.PAYFAST_CANCEL_URL!;
const NOTIFY_URL = process.env.PAYFAST_NOTIFY_URL!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, user_id } = req.body || {};
  if (!amount || !user_id) return res.status(400).json({ error: 'amount and user_id required' });

  const amt = Number(amount).toFixed(2);
  const ref = crypto.randomUUID();

  // Append ref to return URL so success page can poll by reference
  const returnUrlWithRef = `${RETURN_URL}${RETURN_URL.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;

  const params: Record<string, string> = {
    merchant_id: MID,
    merchant_key: MKEY,
    return_url: returnUrlWithRef,
    cancel_url: CANCEL_URL,
    notify_url: NOTIFY_URL,
    amount: amt,
    item_name: `BRICS Deposit ${user_id}`,
    custom_str1: ref,
    custom_str2: user_id,
    email_confirmation: '0'
  };

  params.signature = signPayFastParams(params, PPHR);

  const redirect_url = `${PF_BASE}/eng/process?` + new URLSearchParams(params).toString();
  return res.status(200).json({ redirect_url, ref });
}

