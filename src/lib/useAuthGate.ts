"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth"
import type { User } from "firebase/auth"
import { ensureGoogleAvatar } from "./ensureGoogleAvatar"
import { db } from "./firebase"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated'

// Post-login redirect helpers
export function setPostLoginRedirect(path: string) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('postLoginRedirect', path)
  }
}

export function consumePostLoginRedirect(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const p = sessionStorage.getItem('postLoginRedirect')
  if (p) {
    sessionStorage.removeItem('postLoginRedirect')
    return p
  }
  return null
}

export function useAuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [token, setToken] = useState<string | null>(null)
  const triedThisSessionRef = useRef<Set<string>>(new Set())

  // Ensure handle exists (idempotent)
  const ensureHandle = useCallback(async (u: User): Promise<void> => {
    try {
      const idToken = await u.getIdToken()
      if (!idToken) return
      
      const ensureRes = await fetch('/api/internal/handle/ensure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      })
      if (!ensureRes.ok) {
        console.warn("[auth] handle ensure failed:", await ensureRes.text())
      }
    } catch (handleErr) {
      console.warn("[auth] handle ensure error:", handleErr)
    }
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null)
      
      if (u) {
        // Fetch token
        try {
          const idToken = await u.getIdToken()
          setToken(idToken)
        } catch (e) {
          console.warn("[auth] token fetch failed:", e)
          setToken(null)
        }

        // Auto-fill Google avatar on sign-in (idempotent per session)
        if (!triedThisSessionRef.current.has(u.uid)) {
          triedThisSessionRef.current.add(u.uid)
          try {
            await ensureGoogleAvatar(u)
          } catch (e) {
            console.warn("[auth] ensureGoogleAvatar failed:", e)
          }

          // Normalize user doc: ensure emailLower and balances exist
          try {
            const userRef = doc(db, "users", u.uid)
            const userSnap = await getDoc(userRef)
            
            if (!userSnap.exists()) {
              // New user: initialize with zero balances
              await setDoc(userRef, {
                email: u.email || null,
                emailLower: u.email?.toLowerCase() || null,
                balances: { USDT: 0, ZAR: 0 },
                balanceUSDT: 0,
                balanceZAR: 0,
                balance: 0,
                createdAt: serverTimestamp(),
              })
            } else {
              const data = userSnap.data()!
              const patch: any = {}
              
              // Ensure canonical balances structure exists
              if (!data.balances) {
                const usdt = Number(data.balanceUSDT ?? data.balance ?? 0)
                const zar = Number(data.balanceZAR ?? data.balance ?? usdt)
                patch.balances = { USDT: usdt, ZAR: zar }
              }
              
              // Mirror balanceZAR to balanceUSDT if USDT is missing (until FX)
              if (!('balanceUSDT' in data)) {
                const zarValue = Number(data.balanceZAR ?? data.balance ?? 0)
                patch.balanceUSDT = zarValue
              }
              if (u.email && data.emailLower !== u.email.toLowerCase()) {
                patch.email = u.email
                patch.emailLower = u.email.toLowerCase()
              }
              
              if (Object.keys(patch).length) {
                await updateDoc(userRef, patch)
              }
            }

            // Ensure handle exists (idempotent - only if missing)
            // Re-read userSnap after potential updateDoc to get latest data
            const finalUserSnap = await getDoc(userRef)
            if (!finalUserSnap.exists() || !finalUserSnap.data()?.handle) {
              await ensureHandle(u)
            }
          } catch (e) {
            console.warn("[auth] user doc normalization failed:", e)
          }
        }
      } else {
        setToken(null)
      }
    })
  }, [ensureHandle])

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      console.error("[auth] signOut failed:", e)
    }
  }, [])

  // Compute status
  const status: AuthStatus = user === undefined ? 'loading' : user === null ? 'unauthenticated' : 'authenticated'

  return {
    status,
    user: user ?? null,
    token,
    ensureHandle: user ? () => ensureHandle(user) : undefined,
    signIn: undefined, // Not implemented here - use AuthScreen
    signOut,
    isAuthed: status === 'authenticated',
  }
}
