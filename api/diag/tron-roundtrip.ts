/**
 * Round-trip diagnostic endpoint for TRON integration
 * Tests TronWeb constructor and basic connectivity
 */

export const runtime = 'nodejs';

import { createTronWeb } from '../_tron';

export async function GET() {
  try {
    const tw: any = createTronWeb();
    const blk = await tw.trx.getCurrentBlock();
    const blockNumber =
      blk?.block_header?.raw_data?.number ??
      blk?.blockID ??
      null;
    const body = {
      ok: true,
      hasCtor: typeof tw?.trx?.sendRawTransaction === 'function',
      block: blockNumber,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (err: any) {
    const body = { ok: false, error: String(err?.message ?? err) };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
