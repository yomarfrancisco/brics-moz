// Cross-runtime random helpers for API routes (Node.js/Edge)

import { randomBytes } from 'node:crypto';

/**
 * Generate a random hex string
 * @param bytes Number of random bytes to generate
 * @returns Hex string (2 * bytes characters)
 */
export function randHex(bytes: number = 16): string {
  if (bytes <= 0 || !isFinite(bytes)) {
    throw new Error('randHex: bytes must be a positive number');
  }
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a random UUID (RFC4122-like)
 */
export function randUUID(): string {
  const h = randHex(16);
  // RFC4122 format: xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(12,15)}-a${h.slice(15,18)}-${h.slice(18,32)}`;
}

/**
 * Generate an idempotency key (UUID or fallback)
 */
export function idempotencyKey(): string {
  return randUUID();
}

