/**
 * Sweeper cron: Consolidate user deposits from derived addresses to Treasury
 * Admin-only endpoint (protected by secret header)
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { db } from '../../_firebaseAdmin.js';
import { getUsdtBalance, transferUsdt, SWEEP_MIN_USDT, TRON_DERIVATION_PATH } from '../../_tron.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { deriveTronAddressFromPrivateKey } from '../../_tron.js';

const ADMIN_SECRET = process.env.CRON_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Admin auth check
  const secret = req.headers['x-admin-secret'] || req.body?.secret || '';
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  try {
    // Get master seed (read directly for MVP, no KMS)
    const masterSeed = process.env.TRON_MASTER_SEED;
    if (!masterSeed) {
      throw new Error('TRON_MASTER_SEED not configured');
    }
    const seed = mnemonicToSeedSync(masterSeed);
    const hdKey = HDKey.fromMasterSeed(seed);

    // Get Treasury address
    const treasuryAddress = process.env.TRON_TREASURY_ADDRESS;
    if (!treasuryAddress) {
      throw new Error('TRON_TREASURY_ADDRESS not configured');
    }

    // Get all users with TRON addresses
    const usersSnapshot = await db.collection('users')
      .where('chain_addresses.tron.address', '!=', null)
      .get();

    const results = [];

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();
      const tronData = userData.chain_addresses?.tron;

      if (!tronData || !tronData.address || !tronData.index) {
        continue;
      }

      const userAddress = tronData.address;
      const index = tronData.index;

      try {
        // Check USDT balance
        const balance = await getUsdtBalance(userAddress);

        if (balance < SWEEP_MIN_USDT) {
          continue; // Skip if below threshold
        }

        // Derive private key for this address
        const path = `${TRON_DERIVATION_PATH}/${index}`;
        const child = hdKey.derive(path);
        
        if (!child.privateKey) {
          console.error(`[sweep] Failed to derive key for ${uid} at index ${index}`);
          continue;
        }

        const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
        
        // Transfer minus small fee (0.1 USDT for gas/network)
        const sweepAmount = balance - 0.1;
        
        if (sweepAmount <= 0) {
          continue;
        }

        // Broadcast transfer
        const txId = await transferUsdt(privateKeyHex, treasuryAddress, sweepAmount);

        // Create ledger entry
        const ledgerId = db.collection('ledger').doc().id;
        await db.collection('ledger').doc(ledgerId).set({
          id: ledgerId,
          uid,
          type: 'SWEEP',
          chain: 'TRON',
          token: 'USDT',
          gross: balance,
          fee: 0.1,
          net: sweepAmount,
          status: 'PENDING',
          txId,
          from: userAddress,
          to: treasuryAddress,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Credit user balance (in transaction)
        await db.runTransaction(async (tx) => {
          const userRef = db.collection('users').doc(uid);
          const userSnap = await tx.get(userRef);
          
          if (!userSnap.exists) {
            throw new Error('user_not_found');
          }

          const currentBal = Number(userSnap.data()?.balances?.USDT ?? 0);
          const newBal = currentBal + sweepAmount;

          tx.update(userRef, {
            'balances.USDT': newBal,
            'balances.ZAR': (userSnap.data()?.balances?.ZAR ?? 0) + sweepAmount,
            balanceUSDT: newBal,
            balanceZAR: (userSnap.data()?.balances?.ZAR ?? 0) + sweepAmount,
            balance: (userSnap.data()?.balances?.ZAR ?? 0) + sweepAmount,
          });
        });

        // Update ledger to CONFIRMED (simple immediate mark for MVP)
        await db.collection('ledger').doc(ledgerId).update({
          status: 'CONFIRMED',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({ uid, address: userAddress, amount: sweepAmount, txId });
      } catch (userError: any) {
        console.error(`[sweep] Error processing user ${uid}:`, userError);
        results.push({ uid, error: userError.message });
      }
    }

    return res.status(200).json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (e: any) {
    console.error('[sweep] error:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || 'internal_error',
    });
  }
}

