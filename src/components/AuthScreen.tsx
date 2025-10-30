"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "../lib/firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User,
} from "firebase/auth";
import { ArrowLeft } from "lucide-react";

interface AuthScreenProps {
  onClose: () => void;
  onSuccess?: () => void;
  onAuthed?: () => void;
}

export default function AuthScreen({ onClose, onSuccess, onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // If already authed, bounce to success
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) {
        onSuccess?.();
        onAuthed?.();
      }
    });
    return () => unsub();
  }, [onSuccess, onAuthed]);

  function mapFirebaseError(code: string) {
    const messages: Record<string, string> = {
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/wrong-password": "Email or password is incorrect.",
      "auth/user-not-found": "No account found for that email.",
      "auth/email-already-in-use": "You already have an account. Please sign in instead.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      "auth/weak-password": "Password should be at least 8 characters long.",
    };
    return messages[code] || "Authentication failed. Please try again.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); 
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess?.();
      onAuthed?.();
    } catch (e: any) {
      const code = e?.code ?? "";
      setErr(mapFirebaseError(code));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setErr(null); 
    setResetMsg(null);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
      setResetMsg("Reset email sent.");
    } catch (e: any) {
      const code = e?.code ?? "";
      setErr(code ? mapFirebaseError(code) : "Could not send reset email");
    }
  }

  function goBack() {
    onClose();
  }

  return (
    <div className="auth-page">
      <div className="auth-header">
        <button className="back-btn" aria-label="Back" onClick={goBack}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">{mode === "signup" ? "Create account" : "Sign in"}</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          <label className="label">
            Password
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
          </label>

          {err && <div className="err">{err}</div>}
          {resetMsg && <div className="ok">{resetMsg}</div>}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : (mode === "signup" ? "Create account" : "Sign in")}
          </button>

          <button className="link" type="button" onClick={handleReset}>
            Forgot your password?
          </button>
        </form>

        <div className="switch">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button className="link" onClick={()=>setMode("signin")}>Sign in</button>
            </>
          ) : (
            <>New here?{" "}
              <button className="link" onClick={()=>setMode("signup")}>Create an account</button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-page{
          position:fixed; inset:0;
          background:#F6F7F9; /* light gray like deposit screen backdrop */
          display:flex; flex-direction:column;
          padding:16px;
          z-index: 10000;
        }
        .auth-header{
          height:44px; display:flex; align-items:center;
        }
        .back-btn{
          width:36px; height:36px; border-radius:999px;
          background:#fff; border:1px solid rgba(0,0,0,.08);
          display:grid; place-items:center; font-weight:700;
          cursor: pointer;
          color: #000;
        }
        .back-btn:hover{
          background: #f5f5f5;
        }
        .auth-card{
          margin:8px auto 0;
          width:min(680px, 92vw);
          background:#fff;
          border:1px solid rgba(0,0,0,.08);
          border-radius:16px;
          box-shadow: 0 8px 24px rgba(0,0,0,.06);
          padding:20px 16px;
          max-height: 90vh;
          overflow: auto;
        }
        .auth-title{ margin:4px 0 2px; font-size:20px; font-weight:700; }
        .auth-sub{ margin:0 0 12px; opacity:.7; font-size:13px; }
        .auth-form{ display:grid; gap:12px; }
        .label{ display:grid; gap:6px; font-size:12px; opacity:.9; }
        .input{
          appearance:none; width:100%;
          padding:12px 14px; border-radius:12px;
          border:1px solid #E6E7EB; background:#FAFAFB;
          font-size:16px;
        }
        .primary{
          width:100%; padding:12px 14px; border-radius:12px;
          background:#000; color:#fff; border:1px solid #000;
          font-weight:600; cursor: pointer;
        }
        .primary:disabled{
          opacity: 0.5; cursor: not-allowed;
        }
        .link{
          margin-top:8px; background:transparent; border:none;
          color:#111; text-decoration:underline; font-size:13px;
          cursor: pointer;
        }
        .err{ color:#C74242; font-size:12px; }
        .ok{ color:#1B7F4E; font-size:12px; }
        .switch{ margin-top:8px; font-size:12px; text-align:center; opacity:.85; }
      `}</style>
    </div>
  );
}
