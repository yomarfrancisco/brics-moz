import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeGet, storeSet, storeLog, storeEnabled } from '../_store.js';

const ORIGIN = 'https://brics-moz.vercel.app';
const INSTANT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ALLOW_INSTANT_CREDIT = process.env.ALLOW_INSTANT_RETURN_CREDIT === 'true';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
}

// Helper to get pending stub (uses different key pattern)
async function getPendingStub(ref: string) {
  if (!storeEnabled()) return null;
  const URL = process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!URL || !TOKEN) return null;

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(['HGET', `payfast:pending:${ref}`, 'json']),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const val = data?.result;
    if (!val) return null;

    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Safety: Feature flag check
  if (!ALLOW_INSTANT_CREDIT) {
    await storeLog(`payfast:log:${Date.now()}`, {
      event: 'instant_credit_attempt',
      allowed: false,
      reason: 'feature_disabled',
    });
    return res.status(403).json({ error: 'instant_credit_disabled' });
  }

  try {
    // Derive userId from header (same pattern as provisional-complete)
    const userId = (req.headers['x-user-id'] as string) || null;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { ref } = body || {};

    if (!ref) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        allowed: false,
        reason: 'missing_ref',
      });
      return res.status(400).json({ error: 'ref required' });
    }

    if (!userId) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        ref,
        allowed: false,
        reason: 'missing_user',
      });
      return res.status(401).json({ error: 'unauthorized: missing user' });
    }

    // 1) Check pending stub exists
    const pending = await getPendingStub(ref);

    if (!pending) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        ref,
        userId,
        allowed: false,
        reason: 'no_pending_record',
      });
      return res.status(409).json({ error: 'no_pending_record' });
    }

    // 2) Verify ownership
    if (pending.userId !== userId) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        ref,
        userId,
        allowed: false,
        reason: 'ownership_mismatch',
        owner: pending.userId,
      });
      return res.status(403).json({ error: 'ref not owned by user' });
    }

    // 3) Verify recency
    const age = Date.now() - (pending.createdAt || 0);
    if (age > INSTANT_TTL_MS) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        ref,
        userId,
        allowed: false,
        reason: 'stale_ref',
        age,
      });
      return res.status(410).json({ error: 'ref too old' });
    }

    // 4) Check if already COMPLETE (non-provisional)
    const existing = await storeGet(ref);

    if (existing?.data && existing.data.status === 'COMPLETE' && existing.data.provisional !== true) {
      await storeLog(`payfast:log:${Date.now()}`, {
        event: 'instant_credit_attempt',
        ref,
        userId,
        allowed: true,
        reason: 'already_complete',
      });
      return res.status(200).json({
        status: existing.data.status,
        amount: existing.data.amount_gross || existing.data.amount || '',
        provisional: false,
        ref,
      });
    }

    // 5) Create instant credit record
    const amountZAR = pending.amountZAR ?? 0;

    const record = {
      status: 'COMPLETE',
      userId,
      amount_gross: String(amountZAR),
      amount: String(amountZAR), // For compatibility with status.ts
      payer_email: '',
      pfPaymentId: null,
      provisional: true,
      via: 'instant_return',
      timestamp: Date.now(),
      updated_at: Date.now(),
      raw: {
        instant_return: true,
        created_at: Date.now(),
      },
    };

    // Store canonical record
    await storeSet(ref, record);

    // Store audit record
    const auditRecord = {
      ...record,
      note: 'instant return credit',
    };
    await storeSet(`payfast:instant:${ref}`, auditRecord);

    await storeLog(`payfast:log:${Date.now()}`, {
      event: 'instant_credit_attempt',
      ref,
      userId,
      amountZAR,
      allowed: true,
      reason: 'ok',
    });

    console.log('payfast:instant-credit', { ref, userId, amountZAR });

    return res.status(200).json({
      status: 'COMPLETE',
      provisional: true,
      amount: String(amountZAR),
      ref,
    });
  } catch (err: any) {
    console.error('payfast:instant-credit', { message: err?.message, stack: err?.stack });
    await storeLog(`payfast:log:${Date.now()}`, {
      event: 'instant_credit_error',
      error: String(err?.message),
      stack: err?.stack,
    });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}
