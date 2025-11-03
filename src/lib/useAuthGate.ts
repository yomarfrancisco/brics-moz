"use client"
import { useEffect, useState, useRef } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"
import type { User } from "firebase/auth"
import { ensureGoogleAvatar } from "./ensureGoogleAvatar"
import { db } from "./firebase"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"

export function useAuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const triedThisSessionRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null)
      
      // Auto-fill Google avatar on sign-in (idempotent per session)
      if (u && !triedThisSessionRef.current.has(u.uid)) {
        triedThisSessionRef.current.add(u.uid)
        try {
          await ensureGoogleAvatar(u)
        } catch (e) {
          console.warn("[auth] ensureGoogleAvatar failed:", e)
        }

        // Normalize user doc: ensure emailLower and balanceUSDT exist
        // Also ensure handle exists via API endpoint
        try {
          const userRef = doc(db, "users", u.uid)
          const userSnap = await getDoc(userRef)
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: u.email || null,
              emailLower: u.email?.toLowerCase() || null,
              balanceUSDT: 0,
              balanceZAR: 0,
              createdAt: serverTimestamp(),
            })
          } else {
            const data = userSnap.data()!
            const patch: any = {}
            
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
            try {
              const idToken = await u.getIdToken()
              if (idToken) {
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
              }
            } catch (handleErr) {
              console.warn("[auth] handle ensure error:", handleErr)
            }
          }
        } catch (e) {
          console.warn("[auth] user doc normalization failed:", e)
        }
      }
    })
  }, [])

  return {
    user,                 // undefined = loading, null = not authed, object = authed
    isAuthed: !!user,
  }
}
