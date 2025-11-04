/**
 * Round-trip diagnostic endpoint for TRON integration
 * Tests TronWeb constructor and basic connectivity
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTronWeb } from '../_tron';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const tw: any = createTronWeb();
    const blk = await tw.trx.getCurrentBlock();
    const blockNumber = blk?.block_header?.raw_data?.number ?? blk?.blockID ?? null;

    return res.status(200).json({
      ok: true,
      hasCtor: typeof tw?.trx?.sendRawTransaction === 'function',
      block: blockNumber,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message ?? err),
    });
  }
}
