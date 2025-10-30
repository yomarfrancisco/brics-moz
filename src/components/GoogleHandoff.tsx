import { useEffect } from "react";
import { signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from '@/lib/firebase';

export default function GoogleHandoff() {
  useEffect(() => {
    const doFlow = async () => {
      if (!auth.currentUser) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      try { await getRedirectResult(auth); } catch {}
      const url = new URL(window.location.href);
      const next = url.searchParams.get('next') || 'https://brics.ninja';
      window.location.replace(next);
    };
    void doFlow();
  }, []);

  return <div style={{padding:16}}>Signing you in…</div>;
}
