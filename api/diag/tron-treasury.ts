/**
 * Diagnostic endpoint to check Treasury address balance and resources
 */

export const runtime = 'nodejs';

import { createTronWeb } from '../_tron';

export async function GET() {
  let resp: any;
  try {
    const tw: any = createTronWeb();
    const owner = tw.defaultAddress?.base58 ?? null;
    const sun: number = await tw.trx.getBalance(owner);
    const trx = (Number(sun) / 1_000_000).toFixed(6);
    const acct = await tw.trx.getAccountResources(owner).catch(() => null);
    resp = {
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
    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (err: any) {
    resp = { ok: false, error: String(err?.message ?? err) };
    return new Response(JSON.stringify(resp), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
