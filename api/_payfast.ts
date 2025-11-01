import crypto from 'crypto';

export interface PayFastConfig {
  mode: 'live' | 'sandbox';
  merchantId: string;
  merchantKey: string;
  passphrase: string;
}

export function getPayFastBase(mode: string): string {
  return mode === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
}

export function signPayFastParams(params: Record<string, string>, passphrase?: string): string {
  const enc = (v: string) => encodeURIComponent(v.trim());
  const keys = Object.keys(params).sort();
  let q = keys.map(k => `${k}=${enc(params[k] ?? '')}`).join('&');
  if (passphrase) q += `&passphrase=${enc(passphrase)}`;
  return crypto.createHash('md5').update(q).digest('hex');
}

