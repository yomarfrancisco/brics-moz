import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebase.js';

export const dynamic = 'force-dynamic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // Accept userId from query or header (match current app pattern)
    const uid = (req.query.userId as string) || (req.query.uid as string) || (req.headers['x-user-id'] as string) || '';
    
    if (!uid) {
      return res.status(400).json({ error: 'uid_required' });
    }

    const doc = await db.collection('users').doc(uid).get();
    const balanceZAR = doc.exists ? (doc.data()?.balanceZAR ?? 0) : 0;

    // Return balance (using balanceZAR for consistency with Firestore schema)
    return res.status(200).json({ balance: balanceZAR, balanceZAR });
  } catch (err: any) {
    console.error('wallet:me', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

