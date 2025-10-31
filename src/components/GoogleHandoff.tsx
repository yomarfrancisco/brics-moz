import '../lib/firebase'; // enforce Firebase init in this chunk
import { useEffect } from 'react';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        // ALWAYS check for redirect result first (comes back from Google)
        console.log('[handoff] checking for redirect result…');
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          // Redirect completed successfully
          console.log('[handoff] redirect successful, user:', result.user.email);
          const url = new URL(window.location.href);
          const next = url.searchParams.get('next') || 'https://brics.ninja';
          console.log('[handoff] redirecting to next →', next);
          window.location.replace(next);
          return;
        }

        // No redirect result = we're starting fresh → launch redirect
        if (!auth.currentUser) {
          console.log('[handoff] no pending redirect, launching Google…');
          await signInWithRedirect(auth, googleProvider);
          return;
        }

        // Already signed in (shouldn't happen, but handle it)
        console.log('[handoff] already signed in, redirecting…');
        const url = new URL(window.location.href);
        const next = url.searchParams.get('next') || 'https://brics.ninja';
        window.location.replace(next);
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML = '<pre>Auth error. Check console.</pre>';
      }
    })();
  }, []);
  return <div style={{padding:16,fontFamily:'system-ui'}}>Signing you in…</div>;
}
