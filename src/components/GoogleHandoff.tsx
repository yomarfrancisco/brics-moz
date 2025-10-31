import '../lib/firebase'; // ensure Firebase init
import React, { useEffect } from 'react';
import {
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const FLAG = 'ghandoff_in_progress';

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const next = url.searchParams.get('next') || 'https://brics.ninja';

        // 1) First, try to resolve the redirect result (if we're coming back from Google)
        console.log('[handoff] checking for redirect result…');
        const result = await getRedirectResult(auth);

        if (result?.user) {
          console.log('[handoff] redirect successful →', result.user.email);
          sessionStorage.removeItem(FLAG);
          window.location.replace(next);
          return;
        }

        // 2) If a redirect was initiated earlier, wait for auth state instead of looping
        if (sessionStorage.getItem(FLAG) === '1') {
          console.log('[handoff] flag present; waiting for onAuthStateChanged…');
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
              console.log('[handoff] user arrived via auth state →', user.email);
              sessionStorage.removeItem(FLAG);
              unsub();
              window.location.replace(next);
            }
          });
          // Optional safety timeout: clear the flag after X seconds if nothing arrives
          setTimeout(() => {
            if (sessionStorage.getItem(FLAG) === '1') {
              console.warn('[handoff] timeout waiting for user; clearing flag');
              sessionStorage.removeItem(FLAG);
            }
          }, 10000);
          return;
        }

        // 3) If already signed in (rare on this route), just go back
        if (auth.currentUser) {
          console.log('[handoff] already signed in; returning to next');
          window.location.replace(next);
          return;
        }

        // 4) Fresh start: persist session and launch Google redirect (set the guard flag)
        console.log('[handoff] fresh start → launching Google redirect');
        sessionStorage.setItem(FLAG, '1');
        await setPersistence(auth, browserLocalPersistence);
        await signInWithRedirect(auth, googleProvider);
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML =
          '<pre style="font-family:system-ui;padding:16px">Auth error. Please try again or use desktop.</pre>';
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Signing you in…</div>;
}
