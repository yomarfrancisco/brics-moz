/**
 * Ensure user has a TRON deposit address
 * Derives from master seed using BIP44 path
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import { deriveTronAddressFromPrivateKey, TRON_DERIVATION_PATH, createTronWeb, getUsdtContractAddress } from '../../_tron.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[TRON] ensure-address invoked');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    // Log environment state (no secrets)
    console.log('[TRON] env', {
      hasSeed: !!process.env.TRON_MASTER_SEED,
      hasTreasuryKey: !!process.env.TRON_TREASURY_PRIVKEY,
      hasApiKey: !!(process.env.TRON_PRO_API_KEY || process.env.TRON_API_KEY),
      rpc: process.env.TRON_RPC_URL || 'default',
      hasUsdtContract: !!process.env.TRON_USDT_CONTRACT,
    });

    // Verify USDT contract is configured
    try {
      getUsdtContractAddress();
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message || 'TRON_USDT_CONTRACT missing' });
    }

    // Test TronWeb connection
    const tron = createTronWeb();
    try {
      const nodeInfo = await tron.trx.getNodeInfo();
      console.log('[TRON] node ok', !!nodeInfo);
    } catch (e: any) {
      console.error('[TRON] node error', e);
    }

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
    // Get master seed (read directly for MVP, no KMS)
    console.log('[TRON] Master seed present:', !!process.env.TRON_MASTER_SEED);
    const masterSeed = process.env.TRON_MASTER_SEED;
    if (!masterSeed) {
      console.error('[TRON] TRON_MASTER_SEED not configured');
      throw new Error('TRON_MASTER_SEED not configured');
    }
    
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
    console.error('[TRON][ensure-address]', e);
    return res.status(500).json({
      ok: false,
      route: 'ensure-address',
      error: e?.message ?? 'Internal error',
      stack: e?.stack,
    });
  }
}

