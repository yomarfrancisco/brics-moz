/**
 * Round-trip diagnostic endpoint for TRON integration
 * Tests TronWeb constructor and basic connectivity
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
// ✅ note the .js extension
import { createTronWeb } from '../_tron.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const tw: any = createTronWeb();
    const blk = await tw.trx.getCurrentBlock();
    const blockNumber =
      blk?.block_header?.raw_data?.number ?? blk?.blockID ?? null;
    res.status(200).json({
      ok: true,
      hasCtor: typeof tw?.trx?.sendRawTransaction === 'function',
      block: blockNumber,
    });
  } catch (err: any) {
    console.error('[tron-roundtrip]', err);
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
