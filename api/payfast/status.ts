export const runtime = 'nodejs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'VALIDATION', detail: 'ref parameter required' });
    }

    const payDoc = await db.collection('payments').doc(ref).get();
    
    if (!payDoc.exists) {
      return res.status(404).json({ error: 'payment_not_found' });
    }

    const pay = payDoc.data()!;
    
    console.log('[status]', { ref, status: pay.status });

    return res.status(200).json({
      status: pay.status || 'PENDING',
      amountZAR: pay.amountZAR || 0,
      uid: pay.uid || '',
      ref,
    });
  } catch (err: any) {
    console.error('payfast:status', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'SERVER_ERROR', detail: err?.message || 'unknown error' });
  }
}
