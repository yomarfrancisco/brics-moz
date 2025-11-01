import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'ref parameter required' });
    }

    // If KV not configured, return pending
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(200).json({ ref, status: 'PENDING' });
    }

    try {
      const kvKey = `payfast:${ref}`;
      const r = await fetch(`${process.env.KV_REST_API_URL}/get/${kvKey}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });

      if (r.ok) {
        const data = await r.json();
        if (data && typeof data === 'object') {
          return res.status(200).json({
            ref,
            status: data.status || 'PENDING',
            amount: data.amount || '',
            payer_email: data.payer_email,
            raw: data.raw
          });
        }
      }

      // Key not found = still pending
      return res.status(200).json({ ref, status: 'PENDING' });
    } catch (e: any) {
      console.error('payfast:status', { message: e?.message, stack: e?.stack, context: 'kv_fetch' });
      // On KV error, still return pending (graceful degradation)
      return res.status(200).json({ ref, status: 'PENDING' });
    }
  } catch (err: any) {
    console.error('payfast:status', { message: err?.message, stack: err?.stack, context: 'handler_error' });
    return res.status(500).json({ error: 'SERVER_ERROR', detail: err?.message || 'unknown error' });
  }
}
