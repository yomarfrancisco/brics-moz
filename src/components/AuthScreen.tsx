"use client";

import { useState, useEffect } from "react";
import {
  getAuth as getFirebaseAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getRedirectResult,
  User
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

  // Safe embed detection (cross-origin protected)
  function isEmbedded() {
    try {
      return typeof window !== "undefined" && window.top !== window.self;
    } catch {
      // cross-origin access throws → definitely embedded
      return true;
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referrer = typeof document !== 'undefined' && document.referrer ? document.referrer : "https://www.brics.ninja";
  const nextUrl = referrer.startsWith("https://www.brics.ninja") ? referrer : "https://www.brics.ninja";
  const handoffUrl = `${origin}/auth/google?next=${encodeURIComponent(nextUrl)}`;

  async function handleGoogleClickTopLevel() {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    onAuthed?.();
  }

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auth = getFirebaseAuth();
        const res = await getRedirectResult(auth);
        if (!cancelled && res?.user) {
          onSuccess?.();
          onAuthed?.();
        }
      } catch (e) {
        if (!cancelled) setErr(mapFirebaseError(e?.code || ""));
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
          {isEmbedded() ? (
            <a
              className="google-btn"
              href={handoffUrl}
              target="_top"
              rel="noopener noreferrer"
              aria-label="Continue with Google"
            >
              <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 31.9 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 5.1 29.7 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 5.1 29.7 3 24 3 16.1 3 9.2 7.6 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.4l-6.3-5.3C29.2 35.4 26.8 36.2 24 36c-5.2 0-9.6-3.5-11.2-8.2l-6.6 5.1C9 40.4 16 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.6 5.6-6.7 6.8l6.3 5.3C37.2 42.1 42 37.8 43.9 31.9c.6-1.8.9-3.7.9-5.9 0-1.3-.1-2.3-.4-3.5z"/>
              </svg>
              <span>Continue with Google</span>
            </a>
          ) : (
            <button
              className="google-btn"
              onClick={handleGoogleClickTopLevel}
              aria-label="Continue with Google"
            >
              <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 31.9 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 5.1 29.7 3 24 3 12.3 3 3 12.3 3 24s9.3 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.9 5.1 29.7 3 24 3 16.1 3 9.2 7.6 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.4l-6.3-5.3C29.2 35.4 26.8 36.2 24 36c-5.2 0-9.6-3.5-11.2-8.2l-6.6 5.1C9 40.4 16 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.6 5.6-6.7 6.8l6.3 5.3C37.2 42.1 42 37.8 43.9 31.9c.6-1.8.9-3.7.9-5.9 0-1.3-.1-2.3-.4-3.5z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          )}

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

      <style jsx>{`
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
