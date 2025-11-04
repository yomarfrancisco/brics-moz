/**
 * Diagnostic endpoint for smoke testing USDT transfer
 * GET /api/diag/tron-usdt-send-smoke?to=T...&amount=0.01
 * WARNING: This actually sends real USDT on-chain!
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { transferUsdtViaBuilder, normalizeTronAddress } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const to = req.query.to as string;
    const amtStr = String(req.query.amount ?? '0.01');
    const usdt = Number(amtStr);
    
    if (!to) {
      return res.status(400).json({ 
        ok: false, 
        error: 'to required',
        hint: 'Query param: ?to=T...&amount=0.01 (to must be valid TRON address)'
      });
    }
    
    if (usdt <= 0) {
      return res.status(400).json({ ok: false, error: 'amount must be > 0' });
    }
    
    const tw = createTronWeb();
    
    // Normalize address (handles Base58 and hex, trims whitespace)
    let toHex: string;
    try {
      toHex = normalizeTronAddress(tw, to);
    } catch (e: any) {
      console.error('[diag-send-smoke] raw to:', req.query.to, 'len:', String(req.query.to || '').length);
      return res.status(400).json({ 
        ok: false, 
        error: e.message,
        warning: 'This endpoint sends real USDT on-chain. Use a valid address you control.'
      });
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
    const amountSun = BigInt(Math.round(usdt * 1_000_000));
    const receipt = await transferUsdtViaBuilder(tw, toHex, amountSun);
    
    res.status(200).json({
      ok: true,
      to: tw.address.fromHex(toHex), // Return base58 for display
      toHex,
      amountUSDT: usdt,
      amountSun: amountSun.toString(),
      receipt,
      txid: receipt?.txid || receipt?.txID || receipt?.transaction?.txID || null,
    });
  } catch (e: any) {
    console.error('[tron-usdt-send-smoke]', e);
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}

