/**
 * Diagnostic endpoint to check Treasury address balance and resources
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let result: any;

  try {
    const tw: any = createTronWeb();
    
    // Get treasury private key to derive address
    const treasuryPrivKey = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY;
    if (!treasuryPrivKey) {
      return res.status(500).json({
        ok: false,
        error: 'TRON_TREASURY_PRIVATE_KEY not configured',
      });
    }

    const owner = tw.address.fromPrivateKey(treasuryPrivKey);
    
    // TRX balance (Sun)
    const sun = await tw.trx.getBalance(owner);
    const trx = (Number(sun) / 1_000_000).toFixed(6);
    
    // Simple resource info
    const acct = await tw.trx.getAccountResources(owner).catch(() => null);
    
    result = {
      ok: true,
      owner,
      trxSun: String(sun),
      trxBalance: trx,
      energyLimit: acct?.EnergyLimit ?? null,
      energyUsed: acct?.EnergyUsed ?? null,
      energyAvailable:
        acct && typeof acct.EnergyLimit === 'number' && typeof acct.EnergyUsed === 'number'
          ? acct.EnergyLimit - acct.EnergyUsed
          : null,
      warnings: Number(sun) < 20_000_000 ? ['Low TRX balance; top up ≥ 20 TRX'] : [],
    };

    return res.status(200).json(result);
  } catch (err: any) {
    result = { ok: false, error: String(err?.message ?? err) };
    return res.status(500).json(result);
  }
}
