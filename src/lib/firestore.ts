/**
 * Firestore schema helpers for consistent data access
 */

/**
 * Read USDT balance from Firestore user document
 * Handles multiple field paths for backward compatibility
 */
export function readUsdtFromDoc(doc: any): number {
  if (!doc) return 0;
  
  const data = typeof doc.data === 'function' ? doc.data() : doc;
  if (!data) return 0;
  
  // Try canonical field first
  if (typeof data.balances?.USDT === 'number') {
    return data.balances.USDT;
  }
  
  // Try alternative field names
  if (typeof data.balances?.USDT_TRON === 'number') {
    return data.balances.USDT_TRON;
  }
  
  if (typeof data.balanceUSDT === 'number') {
    return data.balanceUSDT;
  }
  
  // Fallback to ZAR balance as last resort (1:1 mirror)
  if (typeof data.balances?.ZAR === 'number') {
    return data.balances.ZAR;
  }
  
  if (typeof data.balanceZAR === 'number') {
    return data.balanceZAR;
  }
  
  if (typeof data.balance === 'number') {
    return data.balance;
  }
  
  return 0;
}

