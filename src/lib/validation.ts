/**
 * Validation helpers for forms
 */

/**
 * Validate TRON address (base58check, starts with T)
 */
export function isTronAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Basic format check: starts with T, length ~34
  if (!address.startsWith('T') || address.length < 34 || address.length > 34) {
    return false;
  }
  
  // Basic alphanumeric check (base58)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(address);
}

/**
 * Clamp amount to valid range (0 to available)
 */
export function clampAmount(input: number | string, available: number): number {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  if (!isFinite(num) || num < 0) {
    return 0;
  }
  return Math.min(num, available);
}

