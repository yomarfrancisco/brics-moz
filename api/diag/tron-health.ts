/**
 * Diagnostic endpoint to check TRON environment variable configuration
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const hasSeed = !!process.env.TRON_MASTER_SEED;
    const treasuryKey = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY;
    const hasTreasuryKey = !!treasuryKey;
    const hasRpc = !!process.env.TRON_RPC || !!process.env.TRON_RPC_URL;
    const hasApiKey = !!(process.env.TRON_API_KEY || process.env.TRON_PRO_API_KEY); // Optional, for rate limiting
    const usdtContract = process.env.TRON_USDT_CONTRACT;
    const hasUsdtContract = !!usdtContract;

    return res.status(200).json({
      ok: true,
      hasSeed,
      hasTreasuryKey,
      hasRpc,
      hasApiKey,
      hasUsdtContract,
      // Show first/last chars for verification (no full secrets)
      treasuryKeyPrefix: treasuryKey ? `${treasuryKey.substring(0, 4)}...${treasuryKey.substring(treasuryKey.length - 4)}` : null,
      usdtContract,
      usdtContractLength: usdtContract ? usdtContract.length : 0,
    });
  } catch (e: any) {
    console.error('[tron-health] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
      detail: e.stack || undefined,
    });
  }
}

