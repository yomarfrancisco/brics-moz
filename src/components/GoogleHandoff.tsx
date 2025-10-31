import "../lib/firebase";
import React, { useEffect } from "react";
import { auth, authReady } from "../lib/firebase";
import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithRedirect } from "firebase/auth";

const provider = new GoogleAuthProvider();

export default function GoogleHandoff() {
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const url = new URL(window.location.href);
      const next = url.searchParams.get("next") || sessionStorage.getItem("GHANDOFF_NEXT") || "https://brics.ninja";

      // Guard to avoid rapid re-redirect loops
      const key = "pf_last_redirect_ts";
      const last = Number(localStorage.getItem(key) || "0");
      const recentlyRedirected = Date.now() - last < 8000;

      try {
        // Ensure persistence has been applied (best effort)
        await authReady;

        // 1) Attempt redirect result first
        try {
          const res = await getRedirectResult(auth);
          if (res?.user) {
            window.location.replace(next);
            return;
          }
        } catch {}

        // 2) Fallback: listen for auth state (helps iOS when result is null initially)
        let resolved = false;
        unsub = onAuthStateChanged(auth, (u) => {
          if (!resolved && u) {
            resolved = true;
            window.location.replace(next);
          }
        });

        // 3) If no user soon and we haven't just redirected, start redirect
        setTimeout(async () => {
          if (!auth.currentUser && !recentlyRedirected) {
            localStorage.setItem(key, String(Date.now()));
            await signInWithRedirect(auth, provider);
          }
        }, 600); // small delay gives Safari time to hydrate session
      } catch (e) {
        console.error("[handoff:error]", e);
        document.body.innerHTML = "<pre>Auth error. Check console.</pre>";
      }
    })();

    return () => { try { unsub(); } catch {} };
  }, []);

  return <div style={{ padding: 16, fontFamily: "system-ui" }}>Signing you in…</div>;
}
