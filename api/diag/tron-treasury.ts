/**
 * Diagnostic endpoint to check Treasury address balance and resources
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const tw: any = createTronWeb();
    // With a privateKey, TronWeb sets defaultAddress; still guard just in case.
    const owner: string | null = tw?.defaultAddress?.base58 ?? null;
    if (!owner) {
      throw new Error('No defaultAddress; check TRON_TREASURY_PRIVKEY');
    }
    const sun: number = await tw.trx.getBalance(owner); // in SUN
    const trxBalance = (Number(sun) / 1_000_000).toFixed(6);
    let acct: any = null;
    try {
      acct = await tw.trx.getAccountResources(owner);
    } catch {
      // not fatal
    }
    const energyLimit = acct?.EnergyLimit ?? null;
    const energyUsed = acct?.EnergyUsed ?? null;
    const energyAvailable =
      typeof energyLimit === 'number' && typeof energyUsed === 'number'
        ? energyLimit - energyUsed
        : null;
    res.status(200).json({
      ok: true,
      owner,
      trxSun: String(sun),
      trxBalance,
      energyLimit,
      energyUsed,
      energyAvailable,
      warnings: Number(sun) < 20_000_000 ? ['Low TRX balance; top up ≥ 20 TRX'] : [],
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ ok: false, error: String(err?.message ?? err) });
  }
}
