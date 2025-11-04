export const runtime = 'nodejs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';
import admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Guard: only active if ALLOW_TEST_ENDPOINTS is true
  if (process.env.ALLOW_TEST_ENDPOINTS !== 'true') {
    return res.status(403).json({ error: 'test_endpoints_disabled' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const ref = body?.ref as string;
    const uid = body?.uid as string;
    const amountZAR = Number(body?.amountZAR || 0);

    if (!ref || !uid || !Number.isFinite(amountZAR) || amountZAR <= 0) {
      return res.status(400).json({ error: 'bad_request', detail: 'ref, uid, and amountZAR required' });
    }

    // Write PENDING payment to Firestore
    await db.collection('payments').doc(ref).set({
      ref,
      uid,
      amountZAR,
      status: 'PENDING',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      via: 'create',
    });

    return res.status(200).json({ ok: true, ref });
  } catch (err: any) {
    console.error('diag:create-payment', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'internal_error', detail: err?.message });
  }
}

