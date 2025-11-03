import useSWR from 'swr';
import { useAuthGate } from './useAuthGate';

export interface WalletData {
  balances: {
    USDT: number;
    ZAR: number;
  };
  emailLower: string | null;
  email: string | null;
  displayName: string | null;
  avatarURL: string | null;
  // Legacy fields for backwards compat
  balanceUSDT?: number;
  balanceZAR?: number;
  balance?: number;
}

const fallbackData: WalletData = {
  balances: { USDT: 0, ZAR: 0 },
  emailLower: null,
  email: null,
  displayName: null,
  avatarURL: null,
};

async function fetcher(url: string): Promise<WalletData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch wallet: ${res.status}`);
  }
  const data = await res.json();
  
  // Ensure canonical structure
  return {
    balances: {
      USDT: Number(data.balances?.USDT ?? data.balanceUSDT ?? 0),
      ZAR: Number(data.balances?.ZAR ?? data.balanceZAR ?? 0),
    },
    emailLower: data.emailLower ?? null,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    avatarURL: data.avatarURL ?? null,
    balanceUSDT: data.balanceUSDT,
    balanceZAR: data.balanceZAR,
    balance: data.balance,
  };
}

/**
 * useWallet hook - single source of truth for wallet data.
 * Uses SWR with fallbackData and suspense=false.
 * Automatically fetches when user is authenticated.
 */
export function useWallet() {
  const { user, isAuthed } = useAuthGate();
  
  const { data, error, isLoading, mutate } = useSWR<WalletData>(
    isAuthed && user?.uid ? `/api/me?userId=${encodeURIComponent(user.uid)}` : null,
    fetcher,
    {
      fallbackData,
      suspense: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    wallet: data ?? fallbackData,
    isLoading,
    isError: !!error,
    error,
    mutate, // Allow manual revalidation
  };
}

