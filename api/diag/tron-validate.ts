/**
 * Diagnostic endpoint to validate TRON addresses and see what TronWeb sees
 * GET /api/diag/tron-validate?addr=T...
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb, normalizeTronAddress } from '../_tron.js';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query.addr ?? '').trim();
  const tron = createTronWeb();
  
  const base58Valid = tron.isAddress(raw);
  
  let toHexOk = false;
  let hex: string | null = null;
  let err: string | null = null;
  
  try {
    hex = normalizeTronAddress(tron, raw);
    toHexOk = true;
  } catch (e: any) {
    err = e.message;
  }
  
  return res.status(200).json({
    ok: true,
    raw,
    rawLength: raw.length,
    base58Valid,
    toHexOk,
    hex,
    err,
  });
}

