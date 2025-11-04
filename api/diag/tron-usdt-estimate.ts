/**
 * Diagnostic endpoint to estimate energy for USDT transfer
 * GET /api/diag/tron-usdt-estimate?to=T...&amount=123.45
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { estimateUsdtTransfer } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const to = req.query.to as string;
    const amount = Number(req.query.amount || '0'); // in USDT units
    
    if (!to || !(amount > 0)) {
      return res.status(400).json({ ok: false, error: 'to and amount required' });
    }
    
    const tw = createTronWeb();
    const amountSun = Math.round(amount * 1_000_000); // Convert to SUN (6 decimals)
    const est = await estimateUsdtTransfer(tw, to, amountSun);
    
    res.status(200).json({
      ok: true,
      to,
      amountUSDT: amount,
      amountSun,
      energy_used: est.energy_used,
      result: est.result,
    });
  } catch (e: any) {
    console.error('[tron-usdt-estimate]', e);
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}

