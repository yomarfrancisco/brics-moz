/**
 * Diagnostic endpoint for smoke testing USDT transfer
 * GET /api/diag/tron-usdt-send-smoke?to=T...&amount=0.01
 * WARNING: This actually sends real USDT on-chain!
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { transferUsdtViaBuilder, isTronAddress } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const to = req.query.to as string;
    const usdt = Number(req.query.amount || '0.01'); // default 0.01
    
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
    
    // Validate address format before attempting transfer
    if (!isTronAddress(to, tw)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid TRON address format',
        hint: 'Address must be base58check format starting with T (34 chars). Example: TQpKs8c9Qqy3EYHyuqFQnN3aFjEyXuqoGJ',
        received: to.length > 50 ? `${to.substring(0, 20)}...` : to,
        warning: 'This endpoint sends real USDT on-chain. Use a valid address you control.'
      });
    }
    
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

