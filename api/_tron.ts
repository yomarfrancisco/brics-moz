/**
 * TRON helper utilities
 */

export const runtime = 'nodejs';

import TronWeb from 'tronweb';

// Constants
export const USDT_TRON_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Mainnet USDT (TRC-20)
export const SWEEP_MIN_USDT = 1; // Minimum USDT to trigger sweep
export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0"; // TRON BIP44 path

// TRON network configuration
let tronWebInstance: TronWeb | null = null;

/**
 * Get TronWeb instance (singleton)
 */
export function getTronWeb(): TronWeb {
  if (tronWebInstance) {
    return tronWebInstance;
  }

  const rpcUrl = process.env.TRON_RPC_URL || 'https://api.trongrid.io';
  const apiKey = process.env.TRON_API_KEY || process.env.TRON_PRO_API_KEY;
  
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['TRON-PRO-API-KEY'] = apiKey;
  }
  
  tronWebInstance = new TronWeb({
    fullHost: rpcUrl,
    headers,
  });

  return tronWebInstance;
}

/**
 * Get USDT TRC-20 contract instance
 */
export function getUsdtContract(tronWeb: TronWeb) {
  return tronWeb.contract().at(USDT_TRON_CONTRACT);
}

/**
 * Validate TRON address (base58check, starts with T)
 */
export function isTronAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  try {
    const tronWeb = getTronWeb();
    return tronWeb.isAddress(address);
  } catch (e) {
    return false;
  }
}

/**
 * Derive TRON address from private key
 */
export function deriveTronAddressFromPrivateKey(privateKey: string): string {
  const tronWeb = getTronWeb();
  const address = tronWeb.address.fromPrivateKey(privateKey);
  return address;
}

/**
 * Get TRC-20 token balance
 */
export async function getUsdtBalance(address: string): Promise<number> {
  try {
    const tronWeb = getTronWeb();
    const contract = await getUsdtContract(tronWeb);
    const balance = await contract.balanceOf(address).call();
    // TRC-20 USDT uses 6 decimals
    return Number(balance) / 1e6;
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
  amount: number // Amount in USDT (will be converted to 6 decimals)
): Promise<string> {
  try {
    const tronWeb = getTronWeb();
    const contract = await getUsdtContract(tronWeb);
    
    // Convert amount to smallest unit (6 decimals for USDT)
    const amountInSun = Math.floor(amount * 1e6);
    
    // Set private key for signing
    tronWeb.setPrivateKey(fromPrivateKey);
    
    // Build and send transaction
    const result = await contract.transfer(toAddress, amountInSun).send();
    
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
    const tronWeb = getTronWeb();
    return await tronWeb.trx.getTransaction(txId);
  } catch (e) {
    console.error('[getTransactionReceipt] error:', e);
    return null;
  }
}

