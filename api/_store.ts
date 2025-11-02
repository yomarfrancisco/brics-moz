export type PayfastStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

import { redis, rSetJSON, rGetJSON, pf } from './redis.js';

export function storeEnabled() {
  const URL = process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(URL && TOKEN);
}

// Legacy key helper for reading old data (transition support)
function legacyKey(ref: string) {
  return `payfast:${ref}`;
}

export async function storeSet(ref: string, payload: any) {
  if (!storeEnabled()) return { ok: false as const, error: 'STORE_DISABLED' };
  try {
    // Write to new pf:pay: namespace
    await rSetJSON(pf.pay(ref), payload);
    return { ok: true as const };
  } catch (e: any) {
    console.error('[storeSet] failed', { ref, error: e?.message });
    return { ok: false as const, error: e?.message || 'unknown' };
  }
}

export async function storeGet(ref: string) {
  if (!storeEnabled()) {
    return { ok: false as const, status: 'PENDING' as PayfastStatus, detail: 'STORE_DISABLED' };
  }
  try {
    // Try new namespace first
    let parsed = await rGetJSON<any>(pf.pay(ref));
    
    // Fallback to legacy key for transition
    if (!parsed) {
      const legacy = await rGetJSON<any>(legacyKey(ref));
      if (legacy) {
        parsed = legacy;
      }
    }
    
    if (!parsed) {
      return { ok: true as const, status: 'PENDING' as PayfastStatus };
    }
    
    return {
      ok: true as const,
      status: (parsed?.status ?? 'PENDING') as PayfastStatus,
      data: parsed,
    };
  } catch (e: any) {
    console.error('[storeGet] failed', { ref, error: e?.message });
    return { ok: false as const, status: 'PENDING' as PayfastStatus, detail: e?.message };
  }
}

/**
 * Diagnostic logging helper: writes structured logs to Redis for debugging.
 * Uses new pf:log: namespace.
 */
export async function storeLog(key: string, data: any) {
  if (!storeEnabled()) return; // Silent fail if store disabled
  try {
    const payload = { at: new Date().toISOString(), ...data };
    // Convert legacy payfast:log:* to pf:log:* namespace
    let logKey: string;
    if (key.startsWith('pf:log:')) {
      logKey = key; // Already in new namespace
    } else if (key.startsWith('payfast:log:')) {
      // Extract timestamp and convert to new namespace
      const timestamp = key.replace('payfast:log:', '');
      logKey = pf.log(Number(timestamp) || Date.now());
    } else {
      // Generate new key
      logKey = pf.log();
    }
    await rSetJSON(logKey, payload);
  } catch (e: any) {
    // Don't throw - diagnostic logging shouldn't break the main flow
    console.warn('[storeLog] failed', { key, error: e?.message });
  }
}

