/**
 * Ensure user has a TRON deposit address
 * Derives from master seed using BIP44 path
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import { decryptEnv } from '../../_kms.js';
import { deriveTronAddressFromPrivateKey, TRON_DERIVATION_PATH } from '../../_tron.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Auth check
    const authz = req.headers.authorization || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // Check if user already has a TRON address
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data()!;
      const tronAddress = userData?.chain_addresses?.tron?.address;
      
      if (tronAddress) {
        // User already has an address, return it
        return res.status(200).json({ ok: true, address: tronAddress });
      }
    }

    // Need to allocate a new address
    // Get master seed from KMS
    const masterSeedEncrypted = process.env.TRON_MASTER_SEED_ENC;
    if (!masterSeedEncrypted) {
      throw new Error('TRON_MASTER_SEED_ENC not configured');
    }

    const masterSeed = await decryptEnv('TRON_MASTER_SEED_ENC');
    
    // Atomically allocate next index
    const countersRef = db.collection('system').doc('counters');
    const counterDoc = await db.runTransaction(async (tx) => {
      const snap = await tx.get(countersRef);
      const current = snap.exists ? (snap.data()?.tronIndex ?? 0) : 0;
      const next = current + 1;
      
      if (!snap.exists) {
        tx.set(countersRef, { tronIndex: next });
      } else {
        tx.update(countersRef, { tronIndex: next });
      }
      
      return next;
    });

    // Derive address from master seed
    const seed = mnemonicToSeedSync(masterSeed);
    const hdKey = HDKey.fromMasterSeed(seed);
    const path = `${TRON_DERIVATION_PATH}/${counterDoc}`;
    const child = hdKey.derive(path);
    
    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
    const address = deriveTronAddressFromPrivateKey(privateKeyHex);

    // Save to user document
    await userRef.update({
      [`chain_addresses.tron`]: {
        address,
        index: counterDoc,
        path,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    return res.status(200).json({ ok: true, address });
  } catch (e: any) {
    console.error('[ensure-address] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

