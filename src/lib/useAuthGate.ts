"use client"
import { useEffect, useState } from "react"
import { getFirebaseAuth } from "./firebase"
import { onAuthStateChanged, User } from "firebase/auth"

export function useAuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const auth = getFirebaseAuth()
    return onAuthStateChanged(auth, (u) => setUser(u ?? null))
  }, [])

  return {
    user,                 // undefined = loading, null = not authed, object = authed
    isAuthed: !!user,
  }
}
