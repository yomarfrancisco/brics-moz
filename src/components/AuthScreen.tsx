"use client";

import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getRedirectResult
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from '../lib/firebase';
import { ArrowLeft } from "lucide-react";
import { isEmbedded } from '../embed-utils';

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

  // ADD THIS NEW FUNCTION (before onGoogleClick):
  const getNextUrl = () => {
    if (isEmbedded()) {
      // When embedded, return to the app itself, not the parent page
      return window.location.origin + '/';
    }
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    return referrer || window.location.origin + '/';
  };

  // UPDATE onGoogleClick to use the new function:
  const onGoogleClick = async (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    if (isEmbedded()) {
      const nextUrl = getNextUrl(); // ← CHANGE THIS LINE
      const handoff = `/auth/google?next=${encodeURIComponent(nextUrl)}`;
      window.top!.location.href = handoff;
      return;
    }
    // Normal (top-level) behavior:
    await signInWithPopup(auth, googleProvider);
    onAuthed?.();
  };

  // If already authed, bounce to success
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) {
        onSuccess?.();
        onAuthed?.();
      }
    });
    return () => unsub();
  }, [onSuccess, onAuthed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (!cancelled && res?.user) {
          onSuccess?.();
          onAuthed?.();
        }
      } catch (e) {
        if (!cancelled) setErr(mapFirebaseError((e as any)?.code || ""));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
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
      await sendPasswordResetEmail(auth, email);
      setResetMsg("Reset email sent.");
    } catch (e: any) {
      const code = e?.code ?? "";
      setErr(code ? mapFirebaseError(code) : "Could not send reset email");
    }
  }

  function handleBack(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose?.();
  }

  useEffect(() => {
    function onEsc(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="auth-page">
      <div className="auth-header">
        <button
          type="button"
          className="back-btn"
          aria-label="Back"
          onClick={handleBack}
        >
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

          {/* Divider for social sign on */}
          <div className="auth-divider" aria-hidden="true">
            <span className="auth-divider-line" />
            <span className="auth-divider-label">or</span>
            <span className="auth-divider-line" />
          </div>

          {/* Google OAuth Button */}
          <button
            className="google-btn"
            onClick={onGoogleClick}
            aria-label="Continue with Google"
          >
            {/* Google "G" inline SVG to avoid missing asset */}
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48" style={{marginRight:8}}>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33.3 29.2 36 24 36c-7 0-12.8-5.8-12.8-12.8S17 10.4 24 10.4c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.7 4.7 29.7 2.8 24 2.8 12.5 2.8 3.2 12.1 3.2 23.6S12.5 44.4 24 44.4c11.1 0 20.1-9 20.1-20.1 0-1.3-.1-2.5-.5-3.8z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.2 19 13.6 24 13.6c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.7 4.7 29.7 2.8 24 2.8 15.4 2.8 8 7.8 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44.4c5.1 0 9.7-1.9 13.2-5l-6.1-5.1c-2 1.4-4.6 2.2-7.1 2.2-5.2 0-9.7-3.5-11.3-8.2L6 28.1c2.2 7.1 8.9 12.3 18 12.3z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.6 5.9-7.2 7.3l6.1 5.1c-3.4 2.3-7.7 3.6-12.2 3.6 9.1 0 15.8-5.2 18-12.3.8-2.2 1.1-4.5 1.1-7 0-1.3-.1-2.5-.5-3.8z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button type="button" className="link" onClick={handleReset}>
            Forgot your password?
          </button>
        </form>

        <div className="switch">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button type="button" className="link" onClick={()=>setMode("signin")}>Sign in</button>
            </>
          ) : (
            <>New here?{" "}
              <button type="button" className="link" onClick={()=>setMode("signup")}>Create an account</button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .auth-page{
          position:fixed; inset:0;
          background:#F6F7F9; /* light gray like deposit screen backdrop */
          display:flex; flex-direction:column;
          padding:16px;
          z-index: 10000;
          padding-top: 64px;
        }
        .auth-header{
          height:44px; display:flex; align-items:center;
          position: relative;
          z-index: 0;
          pointer-events: none;
        }
        .auth-header .back-btn {
          pointer-events: auto;
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          background: transparent;
        }
        .auth-header::before,
        .auth-header::after {
          pointer-events: none !important;
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
        .auth-title{ margin:4px 0 24px 0; font-size:20px; font-weight:700; }
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
        .auth-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 12px 0 16px;
        }
        .auth-divider-line { flex: 1; height: 1px; background: rgba(0,0,0,0.08); }
        .auth-divider-label { font-size: 12px; color: rgba(0,0,0,0.45); }
        .google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 44px;
          border-radius: 9999px;
          border: 1px solid #e5e7eb;
          background: #fff;
        }
        .google-btn:disabled { opacity: 0.6; }
        .google-icon { width: 18px; height: 18px; display: block; }
      `}</style>
    </div>
  );
}
