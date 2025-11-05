/**
 * Send TRC-20 USDT from Treasury to user-specified TRON address
 */

export const runtime = 'nodejs';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../../_firebaseAdmin.js';
import { isTronAddress, getUsdtContractAddress, createTronWeb } from '../../_tron.js';

const FEE_USDT = 0.2; // Flat fee for MVP

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[TRON] send-tron-usdt invoked');
  
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, amount } = body as {
      to: string;
      amount: number;
    };

    // Validate address
    if (!to || !isTronAddress(to, tron)) {
      return res.status(400).json({ ok: false, error: 'invalid_address' });
    }

    // Validate amount
    const amountNum = Number(amount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' });
    }

    // Calculate total (amount + fee)
    const total = amountNum + FEE_USDT;

    // Transaction: debit balance, create withdrawal record, broadcast TRON tx
    const { withdrawalId } = await db.runTransaction(async (tx: Transaction) => {
      // Read user doc
      const userRef = db.collection('users').doc(uid);
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        throw new Error('user_not_found');
      }

      const userData = userDoc.data()!;
      const balUSDT = Number(userData.balances?.USDT ?? userData.balanceUSDT ?? 0);

      // Validate balance
      if (balUSDT < total) {
        throw new Error('insufficient_funds');
      }

      // Create withdrawal record
      const withdrawalId = db.collection('withdrawals').doc().id;
      const withdrawalRef = db.collection('withdrawals').doc(withdrawalId);

      // Create ledger entry
      const ledgerId = db.collection('ledger').doc().id;
      const ledgerRef = db.collection('ledger').doc(ledgerId);

      const newBalanceUSDT = balUSDT - total;

      // Debit user balance
      tx.update(userRef, {
        'balances.USDT': newBalanceUSDT,
        'balances.ZAR': (userData.balances?.ZAR ?? userData.balanceZAR ?? 0) - total, // Mirror
        balanceUSDT: newBalanceUSDT,
        balanceZAR: (userData.balances?.ZAR ?? userData.balanceZAR ?? 0) - total,
        balance: (userData.balances?.ZAR ?? userData.balanceZAR ?? 0) - total,
      });

      // Write withdrawal record (PENDING, will update with txId)
      tx.set(withdrawalRef, {
        id: withdrawalId,
        uid,
        chain: 'TRON',
        token: 'USDT',
        amount: amountNum,
        fee: FEE_USDT,
        to,
        status: 'PENDING',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Write ledger entry
      tx.set(ledgerRef, {
        id: ledgerId,
        uid,
        type: 'WITHDRAW',
        chain: 'TRON',
        token: 'USDT',
        gross: amountNum,
        fee: FEE_USDT,
        net: amountNum - FEE_USDT,
        status: 'PENDING',
        to,
        withdrawalId, // Link to withdrawal
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { withdrawalId };
    });

    // Broadcast TRON transaction (outside transaction to avoid timeout)
    let txId: string | null = null;
    let toHex: string | null = null;
    let broadcastSuccess = false;
    
    try {
      // Get TronWeb instance and contract
      const tw = createTronWeb();
      const usdtAddr = getUsdtContractAddress();
      const usdt = await tw.contract().at(usdtAddr);
      
      // Get treasury address
      const treasuryPrivKey = process.env.TRON_TREASURY_PRIVATE_KEY || process.env.TRON_TREASURY_PRIVKEY || process.env.TREASURY_TRON_PRIVKEY;
      const ownerAddress = tw.address.fromPrivateKey(treasuryPrivKey!);
      
      // Convert address to hex
      toHex = tw.address.toHex(to);
      
      // Convert amount to smallest unit (USDT has 6 decimals)
      const amountInSmallestUnit = BigInt(Math.round(amountNum * 1_000_000));
      
      // Set fee limit (30 TRX = 30,000,000 SUN)
      const FEE_LIMIT = 30_000_000; // 30 TRX
      
      // Log transaction details before broadcast
      console.log('[send-tron-usdt] Transaction details:', {
        contract: usdtAddr,
        function: 'transfer(address,uint256)',
        feeLimit: FEE_LIMIT,
        callValue: 0,
        owner_address: ownerAddress,
        to_address: to,
        to_hex: toHex,
        amount: amountInSmallestUnit.toString(),
        amountUSDT: amountNum,
      });
      
      // Transfer USDT with proper fee limit
      const sendOpts = { feeLimit: FEE_LIMIT, callValue: 0 };
      const tx = await usdt.methods.transfer(to, amountInSmallestUnit.toString()).send(sendOpts);
      
      // Extract transaction ID
      txId = typeof tx === 'string' ? tx : tx?.txid || tx?.txID || tx?.transaction?.txID || null;
      
      if (!txId) {
        throw new Error('Failed to extract transaction ID from TRON transfer result');
      }

      broadcastSuccess = true;
      console.log('[send-tron-usdt] Broadcast successful', { txId });

      // Return success response immediately after broadcast (don't wait for verification)
      res.status(200).json({
        ok: true,
        phase: 'broadcasted',
        txid: txId, // Primary field name (lowercase)
        txId: txId, // Include both for compatibility
        to,
        toHex,
        amountSun: amountInSmallestUnit.toString(),
        amountUSDT: amountNum,
      });

      // Background updates (fire-and-forget, don't await)
      const withdrawalRef = db.collection('withdrawals').doc(withdrawalId);
      const ledgerQuery = db.collection('ledger')
        .where('withdrawalId', '==', withdrawalId)
        .limit(1)
        .get();

      Promise.all([
        withdrawalRef.update({
          txId,
          status: 'CONFIRMED',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          console.error('[send-tron-usdt] Failed to update withdrawal:', error);
        }),
        ledgerQuery.then((snapshot) => {
          if (!snapshot.empty) {
            const ledgerDoc = snapshot.docs[0];
            return ledgerDoc.ref.update({
              txId,
              status: 'CONFIRMED',
              confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          return null;
        }).catch((err: unknown) => {
          const error = err instanceof Error ? err.message : String(err);
          console.error('[send-tron-usdt] Failed to update ledger:', error);
        }),
      ]).catch(() => {
        // Swallow errors - updates are best-effort after broadcast success
      });

      // Background verification (fire-and-forget, don't await)
      // This runs in the background and never affects the response
      (async () => {
        try {
          // Wait a moment for transaction to propagate
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to get transaction info
          const txInfo = await tw.trx.getTransaction(txId);
          const confirmed = !!txInfo && !!txInfo.txID;
          
          if (confirmed) {
            console.log('[send-tron-usdt] Verification confirmed in background', { txId });
          } else {
            console.warn('[send-tron-usdt] Verification: transaction not found yet', { txId });
          }
        } catch (verifyErr: unknown) {
          const error = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
          console.warn('[send-tron-usdt] Background verification failed (non-fatal)', error);
          // Don't update any state or send any response - this is purely for logging
        }
      })();

      return;
    } catch (txError: any) {
      // Only return error if broadcast failed (pre-broadcast or broadcast error)
      const errorObj = {
        message: txError?.message,
        code: txError?.code,
        txid: txId,
        data: txError?.data || txError?.error || txError,
      };
      
      console.error('[send-tron-usdt] USDT transfer failed', errorObj);
      
      // Mark as failed (only if broadcast didn't succeed)
      if (!broadcastSuccess) {
        await db.collection('withdrawals').doc(withdrawalId).update({
          status: 'FAILED',
          error: txError.message,
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((updateErr: any) => {
          console.error('[send-tron-usdt] Failed to update withdrawal status:', updateErr);
        });
      }

      // Return error only for pre-broadcast/broadcast failures (never return 200 with ok:false)
      return res.status(400).json({
        ok: false,
        error: 'transaction_failed',
        code: 'SEND_USDT_ERROR',
        detail: errorObj,
        stack: txError.stack || undefined,
      });
    }
  } catch (e: any) {
    console.error('[TRON][send-tron-usdt]', e);
    const statusCode = e.message === 'unauthorized' ? 401 : 
                       e.message === 'insufficient_funds' || e.message === 'invalid_amount' || e.message === 'invalid_address' ? 400 : 500;
    return res.status(statusCode).json({
      ok: false,
      route: 'send-tron-usdt',
      error: e?.message ?? 'Internal error',
      stack: e?.stack,
    });
  }
}

