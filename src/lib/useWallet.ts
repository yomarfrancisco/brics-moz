import { useState, useEffect } from 'react';
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
  handle: string | null;
  // Legacy fields for backwards compat
  balanceUSDT?: number;
  balanceZAR?: number;
  balance?: number;
}

const LS_KEY = 'brics.profile';

const fallbackData: WalletData = {
  balances: { USDT: 0, ZAR: 0 },
  emailLower: null,
  email: null,
  displayName: null,
  avatarURL: null,
  handle: null,
};

// Initialize profile from localStorage synchronously
function getCachedProfile(): { avatarURL: string | null; handle: string | null } {
  if (typeof window === 'undefined') return { avatarURL: null, handle: null };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        avatarURL: parsed.avatarURL ?? null,
        handle: parsed.handle ?? null,
      };
    }
  } catch (e) {
    console.warn('[useWallet] Failed to parse cached profile:', e);
  }
  return { avatarURL: null, handle: null };
}

// Cache profile to localStorage
function setCachedProfile(data: Partial<WalletData>) {
  if (typeof window === 'undefined') return;
  try {
    const cached = getCachedProfile();
    const toStore = {
      avatarURL: data.avatarURL ?? cached.avatarURL,
      handle: data.handle ?? cached.handle,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.warn('[useWallet] Failed to cache profile:', e);
  }
}

async function fetcher(url: string): Promise<WalletData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch wallet: ${res.status}`);
  }
  const data = await res.json();
  
  // Ensure canonical structure with null-safe defaults
  const USDT = Number(data.balances?.USDT ?? data.balanceUSDT ?? 0)
  const ZAR = Number(data.balances?.ZAR ?? data.balanceZAR ?? data.balance ?? 0)
  
  return {
    balances: {
      USDT: isFinite(USDT) && USDT >= 0 ? USDT : 0,
      ZAR: isFinite(ZAR) && ZAR >= 0 ? ZAR : 0,
    },
    emailLower: data.emailLower ?? null,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    avatarURL: data.avatarURL ?? null,
    handle: data.handle ?? null,
    balanceUSDT: data.balanceUSDT,
    balanceZAR: data.balanceZAR,
    balance: data.balance,
  };
}

/**
 * useWallet hook - single source of truth for wallet data.
 * Uses SWR with fallbackData and suspense=false.
 * Automatically fetches when user is authenticated.
 * Caches avatarURL in localStorage to prevent flicker.
 */
export function useWallet() {
  const { user, status } = useAuthGate();
  
  // Initialize from localStorage synchronously for instant first paint
  const [cachedProfile, setCachedProfileState] = useState(getCachedProfile);
  
  const { data, error, isLoading, mutate } = useSWR<WalletData>(
    status === 'authenticated' && user?.uid ? `/api/me?userId=${encodeURIComponent(user.uid)}` : null,
    fetcher,
    {
      fallbackData: {
        ...fallbackData,
        avatarURL: cachedProfile.avatarURL,
        handle: cachedProfile.handle,
      },
      suspense: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Update cache when data changes (only if URL actually changed to avoid flicker)
  useEffect(() => {
    if (data) {
      const newAvatarURL = data.avatarURL ?? null;
      const newHandle = data.handle ?? null;
      
      // Only update if changed (avoid unnecessary re-renders)
      if (newAvatarURL !== cachedProfile.avatarURL || newHandle !== cachedProfile.handle) {
        setCachedProfile(data);
        setCachedProfileState({ avatarURL: newAvatarURL, handle: newHandle });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.avatarURL, data?.handle]);

  // Prefetch avatar image to reduce perceived loading time
  useEffect(() => {
    const avatarURL = data?.avatarURL ?? cachedProfile.avatarURL;
    if (avatarURL) {
      const img = new Image();
      img.src = avatarURL;
    }
  }, [data?.avatarURL, cachedProfile.avatarURL]);

  return {
    balances: data?.balances ?? fallbackData.balances,
    handle: data?.handle ?? cachedProfile.handle,
    avatarURL: data?.avatarURL ?? cachedProfile.avatarURL, // Always return cached if available
    refresh: mutate,
    loading: isLoading,
    error: error || null,
  };
}

