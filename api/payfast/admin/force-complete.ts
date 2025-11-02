import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeSet, storeLog } from '../../_store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Verify admin secret
    const adminSecret = req.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SECRET;
    
    if (!expectedSecret) {
      console.error('payfast:admin:force-complete', { error: 'ADMIN_SECRET not configured' });
      return res.status(500).json({ error: 'server_error', detail: 'Admin endpoint not configured' });
    }

    if (adminSecret !== expectedSecret) {
      console.warn('payfast:admin:force-complete', { error: 'unauthorized', provided: adminSecret ? 'present' : 'missing' });
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Parse and validate request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { ref, user_id, amount } = body || {};

    if (!ref || typeof ref !== 'string' || ref.trim() === '') {
      return res.status(400).json({ error: 'bad_params', detail: 'ref is required and must be a non-empty string' });
    }

    if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
      return res.status(400).json({ error: 'bad_params', detail: 'user_id is required and must be a non-empty string' });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'bad_params', detail: 'amount must be a positive number' });
    }

    // Write payment record as COMPLETE
    const timestamp = Date.now();
    await storeSet(ref, {
      status: 'COMPLETE',
      userId: user_id,
      amount: amountNum.toFixed(2),
      amount_gross: amountNum.toFixed(2),
      pfPaymentId: 'ADMIN_FORCE',
      timestamp,
      processed: true,
      updated_at: timestamp,
      raw: {
        admin_forced: true,
        forced_at: timestamp,
        forced_by: 'admin_endpoint',
      }
    });

    // Log the admin action
    const logTs = Date.now();
    await storeLog(`payfast:log:${logTs}`, {
      stage: 'admin_force_complete',
      ref,
      user_id,
      amount: amountNum,
      timestamp,
    });

    console.log('payfast:admin:force-complete', { ref, user_id, amount: amountNum, timestamp });

    return res.status(200).json({ ok: true, ref, user_id, amount: amountNum.toFixed(2) });
  } catch (err: any) {
    console.error('payfast:admin:force-complete', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'server_error', detail: err?.message || 'unknown error' });
  }
}
