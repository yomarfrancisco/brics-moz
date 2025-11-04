/**
 * Diagnostic endpoint to check Treasury address balance and resources
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const tw = createTronWeb();
    
    // Get treasury private key to derive address
    const treasuryPrivKey = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY;
    if (!treasuryPrivKey) {
      return res.status(500).json({
        ok: false,
        error: 'TRON_TREASURY_PRIVATE_KEY not configured',
      });
    }

    const owner = tw.address.fromPrivateKey(treasuryPrivKey);
    
    // Get TRX balance (in SUN, 1 TRX = 1,000,000 SUN)
    const trxSun = await tw.trx.getBalance(owner);
    const trxBalance = Number(trxSun) / 1_000_000;
    
    // Get account resources
    const res = await tw.trx.getAccountResources(owner);
    
    return res.status(200).json({
      ok: true,
      owner,
      trxSun: trxSun.toString(),
      trxBalance: trxBalance.toFixed(6),
      energyLimit: res?.EnergyLimit || 0,
      energyUsed: res?.EnergyUsed || 0,
      energyAvailable: (res?.EnergyLimit || 0) - (res?.EnergyUsed || 0),
      bandwidthLimit: res?.NetLimit || 0,
      bandwidthUsed: res?.NetUsed || 0,
      bandwidthAvailable: (res?.NetLimit || 0) - (res?.NetUsed || 0),
    });
  } catch (e: any) {
    console.error('[tron-treasury] error:', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'internal_error',
      detail: e?.stack || undefined,
    });
  }
}

