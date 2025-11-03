import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // Check if user already has a handle
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data()!;
      if (userData.handle) {
        // Handle already exists, return it
        return res.status(200).json({
          ok: true,
          handle: userData.handle,
        });
      }
    }

    // Generate handle: brics_${uid.slice(0,6)} (lowercase)
    const handle = `brics_${uid.slice(0, 6)}`.toLowerCase();

    // Transaction: ensure handle doesn't exist, then set both docs
    await db.runTransaction(async (tx) => {
      // Read handle doc to check if it exists
      const handleRef = db.collection('handles').doc(handle);
      const handleDoc = await tx.get(handleRef);
      
      if (handleDoc.exists) {
        // Handle taken - this shouldn't happen with brics_ prefix, but handle it
        // Try with longer suffix if needed (fallback)
        throw new Error('handle_exists_unexpected');
      }

      // Verify user doc exists (read)
      const userDocTx = await tx.get(userRef);
      
      if (!userDocTx.exists) {
        throw new Error('user_not_found');
      }
      
      // All reads done, now writes
      tx.set(handleRef, {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(userRef, {
        handle,
      });
    });

    return res.status(200).json({
      ok: true,
      handle,
    });
  } catch (e: any) {
    console.error('[handle/ensure] error:', e);
    
    if (e.message === 'handle_exists_unexpected') {
      // Fallback: try with timestamp suffix
      try {
        const authz = req.headers.authorization || '';
        const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
        const decoded = await admin.auth().verifyIdToken(token);
        const uid = decoded.uid;
        
        const fallbackHandle = `brics_${uid.slice(0, 6)}_${Date.now().toString(36)}`.toLowerCase();
        const handleRef = db.collection('handles').doc(fallbackHandle);
        const userRef = db.collection('users').doc(uid);
        
        await db.runTransaction(async (tx) => {
          const handleDoc = await tx.get(handleRef);
          if (handleDoc.exists) {
            throw new Error('handle_still_conflicts');
          }
          const userDocTx = await tx.get(userRef);
          tx.set(handleRef, {
            uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.update(userRef, {
            handle: fallbackHandle,
          });
        });
        
        return res.status(200).json({
          ok: true,
          handle: fallbackHandle,
        });
      } catch (fallbackErr: any) {
        return res.status(500).json({
          ok: false,
          error: 'handle_generation_failed',
        });
      }
    }
    
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

