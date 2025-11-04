/**
 * Diagnostic endpoint for smoke testing USDT transfer
 * GET /api/diag/tron-usdt-send-smoke?to=T...&amount=0.01
 * WARNING: This actually sends real USDT on-chain!
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { transferUsdtViaBuilder } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const to = req.query.to as string;
    const usdt = Number(req.query.amount || '0.01'); // default 0.01
    
    if (!to) {
      return res.status(400).json({ ok: false, error: 'to required' });
    }
    
    if (usdt <= 0) {
      return res.status(400).json({ ok: false, error: 'amount must be > 0' });
    }
    
    const tw = createTronWeb();
    const amountSun = Math.round(usdt * 1_000_000); // Convert to SUN (6 decimals)
    const receipt = await transferUsdtViaBuilder(tw, to, amountSun);
    
    res.status(200).json({
      ok: true,
      to,
      amountUSDT: usdt,
      amountSun,
      receipt,
      txid: receipt?.txid || receipt?.txID || receipt?.transaction?.txID || null,
    });
  } catch (e: any) {
    console.error('[tron-usdt-send-smoke]', e);
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}

