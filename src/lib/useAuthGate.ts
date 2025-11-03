"use client"
import { useEffect, useState, useRef } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged, User } from "firebase/auth"
import { ensureGoogleAvatar } from "./ensureGoogleAvatar"

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
      }
    })
  }, [])

  return {
    user,                 // undefined = loading, null = not authed, object = authed
    isAuthed: !!user,
  }
}
