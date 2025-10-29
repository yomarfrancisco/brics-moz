"use client"
import { useState } from "react"
import { getFirebaseAuth } from "../lib/firebase"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth"

export default function LoginModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean
  onClose: () => void
  onAuthed: () => void
}) {
  const [mode, setMode] = useState<"signin"|"signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [err, setErr] = useState<string|null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      const auth = getFirebaseAuth()
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      onAuthed()
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? "Authentication failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      display:"grid", placeItems:"center", zIndex:99999
    }}>
      <div style={{
        width:"min(420px, 92vw)", background:"#111", color:"#fff",
        border:"1px solid #333", borderRadius:12, padding:20
      }}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <h3 style={{margin:0}}>{mode === "signup" ? "Create account" : "Sign in"}</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{marginTop:16, display:"grid", gap:12}}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
            style={{padding:"10px 12px", borderRadius:8, border:"1px solid #444", background:"#000", color:"#fff"}}
          />
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
            style={{padding:"10px 12px", borderRadius:8, border:"1px solid #444", background:"#000", color:"#fff"}}
          />
          {err && <div style={{color:"#f66", fontSize:12}}>{err}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{padding:"10px 12px", borderRadius:8, border:"1px solid #666", background:"#0b84", color:"#fff"}}
          >
            {busy ? "Please wait…" : (mode === "signup" ? "Create account" : "Sign in")}
          </button>
        </form>

        <div style={{marginTop:12, fontSize:12, opacity:.8}}>
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={()=>setMode("signin")} style={{textDecoration:"underline"}}>
                Sign in
              </button>
            </>
          ) : (
            <>New here?{" "}
              <button onClick={()=>setMode("signup")} style={{textDecoration:"underline"}}>
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
