import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebase.js';

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
      return res.status(200).json({
        ref,
        status: 'PENDING',
        amount: '',
        payer_email: '',
        raw: null
      });
    }

    const pay = payDoc.data()!;
    
    // Map CREDITED to COMPLETE for status API (backward compatibility)
    const displayStatus = pay.status === 'CREDITED' ? 'COMPLETE' : (pay.status || 'PENDING');
    
    return res.status(200).json({
      ref,
      status: displayStatus,
      amount: pay.amountZAR?.toString() || '',
      payer_email: '',
      raw: null
    });
  } catch (err: any) {
    console.error('payfast:status', { message: err?.message, stack: err?.stack, context: 'handler_error' });
    return res.status(500).json({ error: 'SERVER_ERROR', detail: err?.message || 'unknown error' });
  }
}
