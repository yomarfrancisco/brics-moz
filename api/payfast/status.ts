import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeGet, storeLog } from '../_store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'ref parameter required' });
    }

    const r = await storeGet(ref);
    
    // Diagnostic: Log lookup before returning
    await storeLog(`payfast:log:${Date.now()}`, {
      stage: 'status_lookup',
      ref,
      found: !!r.data,
      status: r.status,
    });
    
    return res.status(200).json({
      ref,
      status: r.status,
      amount: r.data?.amount_gross || '',
      payer_email: r.data?.payer_email || '',
      raw: r.data?.raw || null
    });
  } catch (err: any) {
    console.error('payfast:status', { message: err?.message, stack: err?.stack, context: 'handler_error' });
    return res.status(500).json({ error: 'SERVER_ERROR', detail: err?.message || 'unknown error' });
  }
}
