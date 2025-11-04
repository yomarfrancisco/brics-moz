/**
 * TRON helper utilities
 * Single source of truth for TronWeb instance with ESM-safe imports
 */

export const runtime = 'nodejs';

// Constants
export const SWEEP_MIN_USDT = 1; // Minimum USDT to trigger sweep
export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0"; // TRON BIP44 path

// Single source of truth for TronWeb instance
let _tron: any | null = null;

/**
 * Get TronWeb instance (singleton, pre-configured with API key headers)
 * Uses dynamic ESM import to avoid bundler issues
 */
export async function getTron(): Promise<any> {
  if (_tron) return _tron;

  // ESM-safe import for tronweb@6
  const mod = await import('tronweb');
  const TronWeb = (mod as any).default || (mod as any); // handle default vs namespace

  const fullHost = process.env.TRON_RPC_URL || 'https://api.trongrid.io';
  const headers: Record<string, string> = {};
  const apiKey = process.env.TRON_PRO_API_KEY || process.env.TRON_API_KEY;

  if (apiKey) {
    headers['TRON-PRO-API-KEY'] = apiKey;
  }

  _tron = new TronWeb({
    fullHost,
    headers,
    privateKey: process.env.TRON_TREASURY_PRIVKEY || undefined,
  });

  return _tron;
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
export async function getUsdtContract(tron: any) {
  const contractAddr = getUsdtContractAddress();
  return tron.contract().at(contractAddr);
}

/**
 * Validate TRON address (base58check, starts with T)
 */
export async function isTronAddress(address: string): Promise<boolean> {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  try {
    const tron = await getTron();
    return tron.isAddress(address);
  } catch (e) {
    return false;
  }
}

/**
 * Derive TRON address from private key
 */
export async function deriveTronAddressFromPrivateKey(privateKey: string): Promise<string> {
  const tron = await getTron();
  return tron.address.fromPrivateKey(privateKey);
}

/**
 * Get TRC-20 token balance
 */
export async function getUsdtBalance(address: string): Promise<number> {
  try {
    const tron = await getTron();
    const contract = await getUsdtContract(tron);
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
    const tron = await getTron();
    const contract = await getUsdtContract(tron);
    
    // Convert amount to smallest unit (configurable decimals, default 6)
    const decimals = getUsdtDecimals();
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));
    
    // Set private key for signing
    tron.setPrivateKey(fromPrivateKey);
    
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
    const tron = await getTron();
    return await tron.trx.getTransaction(txId);
  } catch (e) {
    console.error('[getTransactionReceipt] error:', e);
    return null;
  }
}
