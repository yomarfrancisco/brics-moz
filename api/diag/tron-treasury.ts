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
    // Get treasury private key first
    const treasuryPrivKey = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY;
    if (!treasuryPrivKey) {
      return res.status(500).json({
        ok: false,
        error: 'TRON_TREASURY_PRIVATE_KEY not configured',
      });
    }

    // Create TronWeb instance
    let tw: any;
    try {
      tw = createTronWeb();
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: `Failed to create TronWeb instance: ${e.message}`,
        detail: e.stack || undefined,
      });
    }

    const owner = tw.address.fromPrivateKey(treasuryPrivKey);
    
    // Get TRX balance (in SUN, 1 TRX = 1,000,000 SUN)
    let trxSun: any;
    let trxBalance = 0;
    let res: any = {};
    
    try {
      trxSun = await tw.trx.getBalance(owner);
      trxBalance = Number(trxSun) / 1_000_000;
    } catch (e: any) {
      console.error('[tron-treasury] Failed to get balance:', e);
      return res.status(500).json({
        ok: false,
        error: `Failed to get TRX balance: ${e.message}`,
        owner,
        detail: e.stack || undefined,
      });
    }
    
    // Get account resources
    try {
      res = await tw.trx.getAccountResources(owner);
    } catch (e: any) {
      console.error('[tron-treasury] Failed to get account resources:', e);
      // Continue with empty resources object
      res = {};
    }
    
    // Check if balance is sufficient (need ≥ 20 TRX for gas)
    const hasSufficientBalance = trxBalance >= 20;
    const energyAvailable = (res?.EnergyLimit || 0) - (res?.EnergyUsed || 0);
    
    return res.status(200).json({
      ok: true,
      owner,
      trxSun: trxSun.toString(),
      trxBalance: trxBalance.toFixed(6),
      hasSufficientBalance, // ≥ 20 TRX
      energyLimit: res?.EnergyLimit || 0,
      energyUsed: res?.EnergyUsed || 0,
      energyAvailable,
      bandwidthLimit: res?.NetLimit || 0,
      bandwidthUsed: res?.NetUsed || 0,
      bandwidthAvailable: (res?.NetLimit || 0) - (res?.NetUsed || 0),
      warnings: [
        ...(trxBalance < 20 ? ['⚠️ Treasury balance < 20 TRX - may fail transactions'] : []),
        ...(energyAvailable < 1000 ? ['⚠️ Low energy available - may need to rent energy'] : []),
      ],
    });
  } catch (e: any) {
    console.error('[tron-treasury] error:', e);
    // Ensure we always return JSON
    try {
      return res.status(500).json({
        ok: false,
        error: e?.message || 'internal_error',
        detail: e?.stack || undefined,
      });
    } catch (resError: any) {
      // Fallback if res.json fails
      console.error('[tron-treasury] Failed to send JSON response:', resError);
      return res.status(500).end(JSON.stringify({
        ok: false,
        error: e?.message || 'internal_error',
      }));
    }
  }
}

