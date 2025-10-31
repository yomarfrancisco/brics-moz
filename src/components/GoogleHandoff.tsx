import '../lib/firebase';
import React, { useEffect } from 'react';
import {
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const FLAG = 'GHANDOFF_IN_PROGRESS';
const NEXT = 'GHANDOFF_NEXT';

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        // Resolve next from URL OR session (iOS often drops query params after Google)
        const url = new URL(window.location.href);
        const nextFromUrl = url.searchParams.get('next') || '';
        const nextFromSession = sessionStorage.getItem(NEXT) || '';
        const next = nextFromUrl || nextFromSession || 'https://brics.ninja';

        // 1) Try the canonical redirect result first
        const result = await getRedirectResult(auth);
        if (result?.user) {
          sessionStorage.removeItem(FLAG);
          sessionStorage.removeItem(NEXT);
          window.location.replace(next);
          return;
        }

        // 2) If we already kicked off a redirect, wait for hydration
        if (sessionStorage.getItem(FLAG) === '1') {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              sessionStorage.removeItem(FLAG);
              sessionStorage.removeItem(NEXT);
              window.location.replace(next);
            }
          };
          const un1 = onAuthStateChanged(auth, (u) => { if (u) finish(); });
          const un2 = onIdTokenChanged(auth, (u) => { if (u) finish(); });

          // small safety net for iOS timing
          const start = Date.now();
          const t = setInterval(() => {
            if (auth.currentUser) finish();
            if (done || Date.now() - start > 8000) {
              clearInterval(t); un1(); un2();
            }
          }, 250);
          return;
        }

        // 3) Already signed in: just go back
        if (auth.currentUser) {
          sessionStorage.removeItem(FLAG);
          sessionStorage.removeItem(NEXT);
          window.location.replace(next);
          return;
        }

        // 4) Fresh start → persist session + launch redirect
        sessionStorage.setItem(FLAG, '1');
        if (next) sessionStorage.setItem(NEXT, next);
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
