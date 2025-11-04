/**
 * Round-trip diagnostic endpoint for TRON integration
 * Tests TronWeb constructor and basic connectivity
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb, getUsdtContractAddress } from '../../_tron.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Verify USDT contract is configured
    let usdtContractAddr: string;
    try {
      usdtContractAddr = getUsdtContractAddress();
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: e.message || 'TRON_USDT_CONTRACT not configured',
        hasCtor: false,
        block: null,
      });
    }

    // Create TronWeb instance (this tests the constructor)
    let tw: any;
    try {
      tw = createTronWeb();
    } catch (e: any) {
      return res.status(500).json({
        ok: false,
        error: `TronWeb constructor failed: ${e.message}`,
        hasCtor: false,
        block: null,
      });
    }

    // Check if constructor worked (has required methods)
    const hasCtor = typeof (tw.trx && tw.trx.sendRawTransaction) === 'function';

    // Test RPC connectivity
    let block: number | null = null;
    try {
      const currentBlock = await tw.trx.getCurrentBlock();
      block = currentBlock?.block_header?.raw_data?.number ?? null;
    } catch (e: any) {
      console.error('[TRON][roundtrip] RPC test failed:', e);
    }

    return res.status(200).json({
      ok: true,
      hasCtor,
      block,
      usdtContract: usdtContractAddr,
    });
  } catch (e: any) {
    console.error('[TRON][roundtrip]', e);
    // Ensure we always return JSON
    try {
      return res.status(500).json({
        ok: false,
        route: 'tron-roundtrip',
        error: e?.message ?? 'Internal error',
        stack: e?.stack,
        hasCtor: false,
        block: null,
      });
    } catch (resError: any) {
      // Fallback if res.json fails
      console.error('[TRON][roundtrip] Failed to send JSON response:', resError);
      return res.status(500).end(JSON.stringify({
        ok: false,
        error: e?.message ?? 'Internal error',
      }));
    }
  }
}
