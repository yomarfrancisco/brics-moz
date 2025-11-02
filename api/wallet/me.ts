import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBalance } from '../redis.js';

export const dynamic = 'force-dynamic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // Accept userId from query or header (match current app pattern)
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id_required' });
    }

    const balance = await getBalance(userId);

    return res.status(200).json({ balance });
  } catch (err: any) {
    console.error('wallet:me', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

