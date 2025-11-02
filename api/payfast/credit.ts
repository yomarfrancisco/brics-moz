import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis, pf, rGetJSON, rSetJSON } from '../redis.js';

export const dynamic = 'force-dynamic';

const ALLOW_PROVISIONAL = process.env.ALLOW_PROVISIONAL === 'true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Feature flag check
  if (!ALLOW_PROVISIONAL) {
    return res.status(403).json({ error: 'provisional_credit_disabled' });
  }

  try {
    const ref = req.query.ref as string | undefined;
    if (!ref) {
      return res.status(400).json({ error: 'ref_required' });
    }

    // Load stub
    const stub = await rGetJSON<{
      ref: string;
      userId: string;
      amountZAR: number;
      status: string;
      createdAt: number;
      creditedAt?: number;
    }>(pf.pay(ref));

    if (!stub) {
      return res.status(404).json({ error: 'stub_not_found' });
    }

    if (!stub.userId || !stub.amountZAR || !Number.isFinite(stub.amountZAR)) {
      return res.status(422).json({ error: 'malformed_stub', detail: 'missing userId or amountZAR' });
    }

    // Check if already credited
    if (stub.status === 'CREDITED') {
      const balance = await redis.get<number>(`wallet:bal:${stub.userId}`);
      return res.status(200).json({
        ok: true,
        alreadyCredited: true,
        balance: balance ?? 0,
      });
    }

    // Credit the user's balance
    const amountZAR = stub.amountZAR;
    await redis.incrbyfloat(`wallet:bal:${stub.userId}`, amountZAR);

    // Log the transaction
    await redis.lpush(
      `wallet:log:${stub.userId}`,
      JSON.stringify({
        ref,
        type: 'deposit',
        amountZAR,
        ts: Date.now(),
      })
    );

    // Mark stub as credited
    const existing = await rGetJSON<any>(pf.pay(ref));
    const updated = {
      ...(existing || {}),
      ...stub,
      status: 'CREDITED',
      creditedAt: Date.now(),
    };
    await rSetJSON(pf.pay(ref), updated, 60 * 60 * 6); // Keep 6h TTL

    // Get current balance
    const balance = await redis.get<number>(`wallet:bal:${stub.userId}`) ?? 0;

    console.log('payfast:credit', { ref, userId: stub.userId, amountZAR, balance });

    return res.status(200).json({
      ok: true,
      balance,
    });
  } catch (err: any) {
    console.error('payfast:credit', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

