import { useEffect } from "react";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";

export default function GoogleHandoff() {
  useEffect(() => {
    const auth = getAuth();
    const url  = new URL(window.location.href);
    const next = url.searchParams.get("next") || "https://brics.ninja";

    let redirected = false;
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u && !redirected) {
        redirected = true;
        window.location.replace(next);
      } else if (!u && !redirected) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        redirected = true;
        await signInWithRedirect(auth, provider);
      }
    });
    // Defensive: handle the post-redirect result explicitly as well
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user && !redirected) {
          redirected = true;
          window.location.replace(next);
        }
      })
      .catch(() => { /* no-op */ });
    return () => unsub();
  }, []);
  return null;
}
