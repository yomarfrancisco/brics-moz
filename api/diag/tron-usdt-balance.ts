/**
 * Diagnostic endpoint to check USDT balance for a TRON address
 * GET /api/diag/tron-usdt-balance?addr=T...
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron.js';
import { getUsdtBalanceRaw, isTronAddress } from '../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const addr = (req.query.addr as string) || process.env.TRON_TREASURY_ADDRESS || process.env.TREASURY_TRON_ADDRESS;
    
    if (!addr) {
      return res.status(400).json({ ok: false, error: 'addr required (query param: ?addr=T...) or set TRON_TREASURY_ADDRESS env' });
    }
    
    const tw = createTronWeb();
    
    // Validate address format before attempting to query
    if (!isTronAddress(addr, tw)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid TRON address format',
        hint: 'Address must be base58check format starting with T (34 chars). Example: TQpKs8c9Qqy3EYHyuqFQnN3aFjEyXuqoGJ',
        received: addr.length > 50 ? `${addr.substring(0, 20)}...` : addr
      });
    }
    
    const bal = await getUsdtBalanceRaw(tw, addr);
    
    // Convert to USDT (6 decimals)
    const usdtAmount = (Number(bal) / 1_000_000).toFixed(6);
    
    res.status(200).json({
      ok: true,
      addr,
      usdtRaw: bal,
      usdt: usdtAmount,
      decimals: 6,
    });
  } catch (e: any) {
    console.error('[tron-usdt-balance]', e);
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}

