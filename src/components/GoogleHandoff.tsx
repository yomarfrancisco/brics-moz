import '../lib/firebase';
import React, { useEffect } from 'react';
import { signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const next = url.searchParams.get('next') || sessionStorage.getItem('GHANDOFF_NEXT') || 'https://brics.ninja';

        // 1) First try: result from Google redirect
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log('[handoff] redirect result → user, sending to next:', next);
          window.location.replace(next);
          return;
        }

        // 2) iOS fallback: if user is already signed in soon after load, redirect
        let redirected = false;
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u && !redirected) {
            redirected = true;
            console.log('[handoff] onAuthStateChanged → user, sending to next:', next);
            window.location.replace(next);
          }
        });

        // small window for the fallback to fire; then if still no user → start redirect
        setTimeout(async () => {
          unsubscribe();
          if (!auth.currentUser && !redirected) {
            console.log('[handoff] no user yet, launching Google redirect…');
            await signInWithRedirect(auth, googleProvider);
          }
        }, 2000);
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML = '<pre>Auth error. Check console.</pre>';
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Signing you in…</div>;
}
