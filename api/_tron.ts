/**
 * TRON helper utilities
 * Single source of truth for TronWeb instance
 */

export const runtime = 'nodejs';

// ✅ Use named import (ESM exports TronWeb as named export)
import { TronWeb } from 'tronweb';

// Constants
export const SWEEP_MIN_USDT = 1; // Minimum USDT to trigger sweep
export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0"; // TRON BIP44 path

const FULL_HOST = process.env.TRON_RPC || process.env.TRON_RPC_URL || 'https://api.trongrid.io';

const HEADERS = process.env.TRON_PRO_API_KEY || process.env.TRON_API_KEY
  ? { 'TRON-PRO-API-KEY': (process.env.TRON_PRO_API_KEY || process.env.TRON_API_KEY)! }
  : undefined;

/**
 * Create a TronWeb instance with proper configuration
 * @param pk Optional private key (defaults to TRON_TREASURY_PRIVATE_KEY env var)
 */
export function createTronWeb(pk?: string): any {
  const privateKey = pk ?? process.env.TRON_TREASURY_PRIVATE_KEY ?? process.env.TRON_TREASURY_PRIVKEY;
  
  if (!privateKey) {
    throw new Error('TRON_TREASURY_PRIVATE_KEY missing');
  }

  // Some type defs for tronweb are messy; force as any for ctor
  const TW: any = TronWeb;

  return new TW({
    fullHost: FULL_HOST,
    headers: HEADERS,
    privateKey,
  });
}

/**
 * Helper: must be provided via env, fail loudly if missing
 */
export function getUsdtContractAddress(): string {
  const addr = process.env.TRON_USDT_CONTRACT;
  if (!addr) {
    throw new Error('TRON_USDT_CONTRACT missing');
  }
  return addr;
}

/**
 * Get USDT decimals (default: 6 for TRC-20 USDT)
 */
export function getUsdtDecimals(): number {
  const decimals = process.env.TRON_USDT_DECIMALS;
  if (decimals) {
    const parsed = parseInt(decimals, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 6; // Default for TRC-20 USDT
}

/**
 * Get USDT TRC-20 contract instance
 */
export function getUsdtContract(tron: any) {
  const contractAddr = getUsdtContractAddress();
  return tron.contract().at(contractAddr);
}

/**
 * Validate TRON address (base58check, starts with T)
 */
export function isTronAddress(address: string, tron?: any): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  try {
    const tw = tron || createTronWeb();
    return tw.isAddress(address);
  } catch (e) {
    return false;
  }
}

/**
 * Derive TRON address from private key
 */
export function deriveTronAddressFromPrivateKey(privateKey: string): string {
  const tron = createTronWeb(privateKey);
  return tron.address.fromPrivateKey(privateKey);
}

/**
 * Get TRC-20 token balance
 */
export async function getUsdtBalance(address: string): Promise<number> {
  try {
    const tron = createTronWeb();
    const contract = getUsdtContract(tron);
    const balance = await contract.balanceOf(address).call();
    // Use configurable decimals (default 6 for TRC-20 USDT)
    const decimals = getUsdtDecimals();
    return Number(balance) / Math.pow(10, decimals);
  } catch (e) {
    console.error('[getUsdtBalance] error:', e);
    return 0;
  }
}

/**
 * Transfer TRC-20 USDT
 */
export async function transferUsdt(
  fromPrivateKey: string,
  toAddress: string,
  amount: number // Amount in USDT (will be converted to smallest unit)
): Promise<string> {
  try {
    const tron = createTronWeb(fromPrivateKey);
    const contract = getUsdtContract(tron);
    
    // Convert amount to smallest unit (configurable decimals, default 6)
    const decimals = getUsdtDecimals();
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));
    
    // Build and send transaction
    const result = await contract.transfer(toAddress, amountInSmallestUnit).send();
    
    // Extract transaction ID from result
    // TronWeb returns transaction object with txid property
    const txId = result?.txid || result?.txID || result?.transaction?.txID || result;
    
    if (typeof txId !== 'string') {
      throw new Error('Failed to extract transaction ID from TRON transfer result');
    }
    
    return txId;
  } catch (e: any) {
    console.error('[transferUsdt] error:', e);
    throw new Error(`TRON transfer failed: ${e.message}`);
  }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(txId: string): Promise<any> {
  try {
    const tron = createTronWeb();
    return await tron.trx.getTransaction(txId);
  } catch (e) {
    console.error('[getTransactionReceipt] error:', e);
    return null;
  }
}
