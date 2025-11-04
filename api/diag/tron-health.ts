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
    const hasTreasuryKey = !!(process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY);
    const hasRpc = !!process.env.TRON_RPC_URL;
    const hasApiKey = !!(process.env.TRON_API_KEY || process.env.TRON_PRO_API_KEY); // Optional, for rate limiting

    return res.status(200).json({
      ok: true,
      hasSeed,
      hasTreasuryKey,
      hasRpc,
      hasApiKey,
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

