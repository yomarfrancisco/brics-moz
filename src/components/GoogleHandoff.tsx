import '@/lib/firebase'; // enforce Firebase init in this chunk
import { useEffect } from 'react';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        if (!auth.currentUser) {
          console.log('[handoff] launching Google redirect…');
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        console.log('[handoff] user present, resolving redirect result…');
        try { await getRedirectResult(auth); } catch {}
        const url = new URL(window.location.href);
        const next = url.searchParams.get('next') || 'https://brics.ninja';
        console.log('[handoff] redirecting to next →', next);
        window.location.replace(next);
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML = '<pre>Auth error. Check console.</pre>';
      }
    })();
  }, []);
  return <div style={{padding:16,fontFamily:'system-ui'}}>Signing you in…</div>;
}
