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
          console.log('[handoff] redirect result found →', result.user.email);
          sessionStorage.removeItem(FLAG);
          sessionStorage.removeItem(NEXT);
          window.location.replace(next);
          return;
        }

        // 2) Already signed in: just go back
        if (auth.currentUser) {
          console.log('[handoff] already signed in →', auth.currentUser.email);
          sessionStorage.removeItem(FLAG);
          sessionStorage.removeItem(NEXT);
          window.location.replace(next);
          return;
        }

        // 3) If we already kicked off a redirect, wait for hydration (iOS fallback)
        if (sessionStorage.getItem(FLAG) === '1') {
          console.log('[handoff] flag present; waiting for auth hydration…');
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              console.log('[handoff] auth hydration complete →', auth.currentUser?.email);
              sessionStorage.removeItem(FLAG);
              sessionStorage.removeItem(NEXT);
              window.location.replace(next);
            }
          };
          
          // Dual listeners + polling for iOS timing issues
          const un1 = onAuthStateChanged(auth, (u) => { if (u) finish(); });
          const un2 = onIdTokenChanged(auth, (u) => { if (u) finish(); });

          // Polling fallback (iOS Safari sometimes delays auth state)
          const start = Date.now();
          const t = setInterval(() => {
            if (auth.currentUser) finish();
            if (done || Date.now() - start > 8000) {
              clearInterval(t);
              un1();
              un2();
              if (!done) {
                console.warn('[handoff] timeout waiting for auth; user may be stuck');
              }
            }
          }, 250);
          return;
        }

        // 4) Fresh start → persist session + launch redirect
        console.log('[handoff] fresh start → launching Google redirect');
        sessionStorage.setItem(FLAG, '1');
        if (next) sessionStorage.setItem(NEXT, next);
        
        // Set up fallback listener BEFORE redirect (in case redirect result is lost)
        let fallbackActive = true;
        const fallbackUnsub = onAuthStateChanged(auth, (u) => {
          if (fallbackActive && u && sessionStorage.getItem(FLAG) === '1') {
            console.log('[handoff] fallback: user arrived via auth state →', u.email);
            fallbackActive = false;
            sessionStorage.removeItem(FLAG);
            sessionStorage.removeItem(NEXT);
            fallbackUnsub();
            window.location.replace(next);
          }
        });
        
        await setPersistence(auth, browserLocalPersistence);
        await signInWithRedirect(auth, googleProvider);
        
        // Clean up fallback after 10s if redirect completes normally
        setTimeout(() => {
          if (fallbackActive) {
            fallbackUnsub();
            fallbackActive = false;
          }
        }, 10000);
      } catch (e) {
        console.error('[handoff:error]', e);
        sessionStorage.removeItem(FLAG);
        sessionStorage.removeItem(NEXT);
        document.body.innerHTML =
          '<pre style="font-family:system-ui;padding:16px">Auth error. Please try again or use desktop.</pre>';
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Signing you in…</div>;
}
