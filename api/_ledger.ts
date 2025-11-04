/**
 * Shared ledger utilities for recording journal entries and updating balances
 */

import type { Transaction } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { db } from './_firebaseAdmin.js';
import crypto from 'crypto';

export interface JournalEntry {
  kind: string; // 'treasury_refill' | 'sweep' | 'withdraw' | 'transfer' | etc.
  txid: string;
  logIndex?: number;
  block?: number;
  ts: Date;
  uid: string;
  handle?: string;
  amountStr: string; // "5.000000" (6 decimals)
  asset: string; // "USDT_TRON"
  meta?: Record<string, any>;
}

/**
 * Generate event ID for idempotency (hash of txid + logIndex)
 */
function generateEventId(txid: string, logIndex?: number): string {
  const input = logIndex !== undefined ? `${txid}_${logIndex}` : txid;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

/**
 * Record journal entry and update balance (idempotent)
 * Uses Firestore transaction to ensure atomicity
 */
export async function recordJournalAndUpdateBalance(
  entry: JournalEntry,
  tx?: Transaction
): Promise<{ journalId: string; newBalance: number }> {
  const eventId = generateEventId(entry.txid, entry.logIndex);
  const journalId = db.collection('journal').doc().id;
  
  const journalData = {
    id: journalId,
    eventId,
    kind: entry.kind,
    txid: entry.txid,
    logIndex: entry.logIndex ?? null,
    block: entry.block ?? null,
    ts: admin.firestore.Timestamp.fromDate(entry.ts),
    uid: entry.uid,
    handle: entry.handle || null,
    amountStr: entry.amountStr,
    asset: entry.asset,
    meta: entry.meta || {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Check if event already processed (idempotency check)
  const eventIndexRef = db.collection('journal_index').doc(eventId);
  
  if (tx) {
    // Use provided transaction
    const eventDoc = await tx.get(eventIndexRef);
    if (eventDoc.exists) {
      const existingJournalId = eventDoc.data()!.journalId;
      console.log('[ledger] Event already processed (idempotent)', { eventId, existingJournalId });
      
      // Return existing journal entry
      const existingJournal = await db.collection('journal').doc(existingJournalId).get();
      const existingBalance = existingJournal.data()?.balanceAfter || 0;
      return { journalId: existingJournalId, newBalance: existingBalance };
    }
    
    // Record new journal entry
    const journalRef = db.collection('journal').doc(journalId);
    tx.set(journalRef, journalData);
    tx.set(eventIndexRef, { journalId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    
    // Update user balance (add for credits like treasury_refill, sweep, deposit)
    const userRef = db.collection('users').doc(entry.uid);
    const userDoc = await tx.get(userRef);
    const currentBalance = userDoc.data()?.balances?.USDT ?? userDoc.data()?.balanceUSDT ?? 0;
    const amount = Number(entry.amountStr);
    // For treasury_refill, sweep, deposit: add amount (credit)
    // For withdraw, transfer_out: subtract amount (debit) - handled by negative amountStr
    const newBalance = currentBalance + amount;
    
    tx.update(userRef, {
      'balances.USDT': newBalance,
      'balances.ZAR': (userDoc.data()?.balances?.ZAR ?? 0) + amount, // Mirror 1:1 for now
      balanceUSDT: newBalance, // Legacy field
      balanceZAR: (userDoc.data()?.balances?.ZAR ?? 0) + amount,
      balance: (userDoc.data()?.balances?.ZAR ?? 0) + amount,
    });
    
    // Add balanceAfter to journal entry
    tx.update(journalRef, { balanceAfter: newBalance });
    
    return { journalId, newBalance };
  } else {
    // Create new transaction
    return await db.runTransaction(async (t: Transaction) => {
      const eventDoc = await t.get(eventIndexRef);
      if (eventDoc.exists) {
        const existingJournalId = eventDoc.data()!.journalId;
        const existingJournal = await db.collection('journal').doc(existingJournalId).get();
        const existingBalance = existingJournal.data()?.balanceAfter || 0;
        return { journalId: existingJournalId, newBalance: existingBalance };
      }
      
      const journalRef = db.collection('journal').doc(journalId);
      t.set(journalRef, journalData);
      t.set(eventIndexRef, { journalId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      
      const userRef = db.collection('users').doc(entry.uid);
      const userDoc = await t.get(userRef);
      const currentBalance = userDoc.data()?.balances?.USDT ?? userDoc.data()?.balanceUSDT ?? 0;
      const amount = Number(entry.amountStr);
      const newBalance = currentBalance + amount;
      
      t.update(userRef, {
        'balances.USDT': newBalance,
        'balances.ZAR': (userDoc.data()?.balances?.ZAR ?? 0) + amount,
        balanceUSDT: newBalance,
        balanceZAR: (userDoc.data()?.balances?.ZAR ?? 0) + amount,
        balance: (userDoc.data()?.balances?.ZAR ?? 0) + amount,
      });
      
      t.update(journalRef, { balanceAfter: newBalance });
      
      return { journalId, newBalance };
    });
  }
}

/**
 * Resolve handle to uid and TRON address (shared utility)
 */
export async function resolveWalletHandle(handle: string): Promise<{ uid: string; tronAddress: string }> {
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
  
  if (!/^[a-z0-9_]{3,15}$/.test(normalizedHandle)) {
    throw new Error(`Invalid handle format: ${handle}`);
  }
  
  const handleRef = db.collection('handles').doc(normalizedHandle);
  const handleDoc = await handleRef.get();
  
  if (!handleDoc.exists) {
    throw new Error(`Handle not found: ${handle}`);
  }
  
  const uid = handleDoc.data()!.uid as string;
  if (!uid) {
    throw new Error(`Handle has no uid: ${handle}`);
  }
  
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`User not found for handle: ${handle}`);
  }
  
  const tronAddress = userDoc.data()?.chain_addresses?.tron?.address;
  if (!tronAddress) {
    throw new Error(`User has no TRON address for handle: ${handle}`);
  }
  
  return { uid, tronAddress };
}

