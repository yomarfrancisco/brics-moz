/**
 * Diagnostic endpoint to estimate energy for USDT transfer
 * GET /api/diag/tron-usdt-estimate?to=T...&amount=123.45
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { estimateUsdtTransfer, normalizeTronAddress } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const to = req.query.to as string;
    const amtStr = String(req.query.amount ?? '0');
    const amount = Number(amtStr);
    
    if (!to || !(amount > 0)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'to and amount required',
        hint: 'Query params: ?to=T...&amount=0.01 (to must be valid TRON address, amount > 0)'
      });
    }
    
    const tw = createTronWeb();
    
    // Normalize address (handles Base58 and hex, trims whitespace)
    let toHex: string;
    try {
      toHex = normalizeTronAddress(tw, to);
    } catch (e: any) {
      console.error('[diag-estimate] raw to:', req.query.to, 'len:', String(req.query.to || '').length);
      return res.status(400).json({ ok: false, error: e.message });
    }
    
    // Optional: soft check if account is activated (non-blocking)
    try {
      const acc = await tw.trx.getAccount(tw.address.fromHex(toHex));
      if (!acc?.address) {
        console.warn('[tron] receiver not activated');
      }
    } catch {
      // Not fatal, just a warning
    }
    
    // Convert USDT to SUN (6 decimals)
    const amountSun = BigInt(Math.round(amount * 1_000_000));
    const est = await estimateUsdtTransfer(tw, toHex, amountSun);
    
    res.status(200).json({
      ok: true,
      to: tw.address.fromHex(toHex), // Return base58 for display
      toHex,
      amountUSDT: amount,
      amountSun: amountSun.toString(),
      energy_used: est.energy_used,
      result: est.result,
    });
  } catch (e: any) {
    console.error('[tron-usdt-estimate]', e);
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}

