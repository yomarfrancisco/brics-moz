import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeGet, storeSet, storeLog, storeEnabled } from '../_store.js';

const ORIGIN = 'https://brics-moz.vercel.app';
const PROVISIONAL_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ALLOW_PROVISIONAL = process.env.ALLOW_PROVISIONAL === 'true';

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

  // Guardrail: Feature flag
  if (!ALLOW_PROVISIONAL) {
    await storeLog(`payfast:log:${Date.now()}`, {
      stage: 'provisional_reject',
      reason: 'feature_disabled',
    });
    return res.status(403).json({ error: 'provisional_completion_disabled' });
  }

  try {
    // Derive userId from header (dev) or session (prod)
    // For now, use x-user-id header as specified
    const userId = (req.headers['x-user-id'] as string) || null;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { ref } = body || {};

    if (!ref) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_reject',
        reason: 'missing_ref',
      });
      return res.status(400).json({ error: 'ref required' });
    }

    if (!userId) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_reject',
        ref,
        reason: 'missing_user',
      });
      return res.status(401).json({ error: 'unauthorized: missing user' });
    }

    // 1) Ownership + recency check
    const pending = await getPendingStub(ref);

    if (!pending) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_reject',
        ref,
        userId,
        reason: 'no_pending_stub',
      });
      return res.status(409).json({ error: 'No pending record; cannot provisional-complete.' });
    }

    const pendingData = pending;

    if (pendingData.userId !== userId) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_reject',
        ref,
        userId,
        reason: 'ownership_mismatch',
        owner: pendingData.userId,
      });
      return res.status(403).json({ error: 'ref not owned by user' });
    }

    const age = Date.now() - (pendingData.createdAt || 0);
    if (age > PROVISIONAL_TTL_MS) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_reject',
        ref,
        userId,
        reason: 'stale_ref',
        age,
      });
      return res.status(410).json({ error: 'ref too old' });
    }

    // 2) If already finalized, return existing canonical state
    const existing = await storeGet(ref);

    if (existing?.data && existing.data.status === 'COMPLETE' && existing.data.provisional !== true) {
      await storeLog(`payfast:log:${Date.now()}`, {
        stage: 'provisional_already_complete',
        ref,
        userId,
      });
      return res.status(200).json({
        status: existing.data.status,
        amount: existing.data.amount_gross || existing.data.amount || '',
        provisional: false,
      });
    }

    // 3) Provisional COMPLETE
    const amountZAR = pendingData.amountZAR ?? 0;

    const record = {
      status: 'COMPLETE',
      userId,
      amount_gross: String(amountZAR),
      amount: String(amountZAR), // For compatibility with status.ts
      payer_email: '',
      provisional: true,
      via: 'provisional',
      updated_at: Date.now(),
      raw: {
        provisional: true,
        created_at: Date.now(),
      },
    };

    await storeSet(ref, record);

    await storeLog(`payfast:log:${Date.now()}`, {
      stage: 'provisional_complete',
      ref,
      userId,
      amountZAR,
    });

    console.log('payfast:provisional-complete', { ref, userId, amountZAR });

    return res.status(200).json({
      status: 'COMPLETE',
      amount: String(amountZAR),
      provisional: true,
    });
  } catch (err: any) {
    console.error('payfast:provisional-complete', { message: err?.message, stack: err?.stack });
    await storeLog(`payfast:log:${Date.now()}`, {
      stage: 'provisional_error',
      error: String(err?.message),
      stack: err?.stack,
    });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}
