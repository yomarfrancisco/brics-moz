import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_firebaseAdmin.js';

export const dynamic = 'force-dynamic';

/**
 * Canonical user endpoint returning canonical balances structure.
 * Returns { balances: { USDT, ZAR }, emailLower, displayName, ... }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // Accept userId from query or header
    const uid = (req.query.userId as string) || (req.query.uid as string) || (req.headers['x-user-id'] as string) || '';
    
    if (!uid) {
      return res.status(400).json({ error: 'uid_required' });
    }

    const doc = await db.collection('users').doc(uid).get();
    const data = doc.exists ? doc.data() : {};
    
    // Read from canonical balances structure, fallback to legacy fields for backwards compat
    const balances = {
      USDT: Number(data?.balances?.USDT ?? data?.balanceUSDT ?? data?.balanceZAR ?? data?.balance ?? 0),
      ZAR: Number(data?.balances?.ZAR ?? data?.balanceZAR ?? data?.balance ?? 0),
    };

    // Return canonical structure
    return res.status(200).json({
      balances,
      emailLower: data?.emailLower ?? null,
      email: data?.email ?? null,
      displayName: data?.displayName ?? null,
      avatarURL: data?.avatarURL ?? null,
      handle: data?.handle ?? null,
      tronAddress: data?.chain_addresses?.tron?.address ?? null,
      // Include legacy fields for backwards compat during transition
      balanceUSDT: balances.USDT,
      balanceZAR: balances.ZAR,
      balance: balances.ZAR,
    });
  } catch (err: any) {
    console.error('api/me', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

