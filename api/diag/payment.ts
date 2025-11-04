export const runtime = 'nodejs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'ref_required' });
    }

    const payDoc = await db.collection('payments').doc(ref).get();

    if (!payDoc.exists) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    const data = payDoc.data();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('diag:payment', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

