import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_firebaseAdmin.js';

export default async function handler(_: VercelRequest, res: VercelResponse) {
  try {
    await db.listCollections();

    res.status(200).json({
      ok: true,
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      hasKey: !!process.env.FIREBASE_PRIVATE_KEY
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

