import '../lib/firebase';
import React, { useEffect } from 'react';
import { signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const ALLOWED_ORIGINS = [
  'https://brics.ninja',
  'https://www.brics.ninja',
  'https://brics-moz.vercel.app',
  'https://buybrics.vercel.app',
];

function sanitizeNext(next: string | null | undefined, fallback: string) {
  try {
    if (!next) return fallback;
    if (next.startsWith('/')) return next;
    const u = new URL(next);
    if (ALLOWED_ORIGINS.includes(u.origin)) return next;
  } catch {}
  return fallback;
}

export default function GoogleHandoff() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const rawNext =
          url.searchParams.get('next') ||
          sessionStorage.getItem('GHANDOFF_NEXT') ||
          (import.meta as any).env?.VITE_APP_BASE_URL ||
          'https://brics.ninja';
        const next = sanitizeNext(rawNext as string, 'https://brics.ninja');
        console.info('[handoff] start, next =', next);

        // 1) If Google already handed us a result, finish fast.
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.info('[handoff] redirect result → user');
          try { window.parent?.postMessage({ type: 'BRICS_AUTH', status: 'success', next }, '*'); } catch {}
          try { if (window.top && window.top !== window.self) { window.top.location.href = next; return; } } catch {}
          window.location.replace(next);
          return;
        }

        // 2) Fallback: wait for auth state (iOS/webview can be late)
        let completed = false;
        const unsub = onAuthStateChanged(auth, (u) => {
          if (u && !completed) {
            completed = true;
            console.info('[handoff] onAuthStateChanged → user');
            try { window.parent?.postMessage({ type: 'BRICS_AUTH', status: 'success', next }, '*'); } catch {}
            try { if (window.top && window.top !== window.self) { window.top.location.href = next; return; } } catch {}
            window.location.replace(next);
          }
        });

        const now = Date.now();
        const lastTried = Number(sessionStorage.getItem('GHANDOFF_TRIED_AT') || '0');
        const recentlyTried = now - lastTried < 30000; // 30s fuse

        // 3) After a grace period, attempt redirect exactly once
        window.setTimeout(async () => {
          unsub();

          if (!auth.currentUser && !completed) {
            if (recentlyTried) {
              console.warn('[handoff] Skip re-redirect (fuse). Showing Continue.');
              try { window.parent?.postMessage({ type: 'BRICS_AUTH', status: 'stuck', next }, '*'); } catch {}
              const btn = document.createElement('button');
              btn.textContent = 'Continue';
              btn.style.cssText = 'padding:10px 14px;border:1px solid #ddd;border-radius:8px;margin-top:12px';
              btn.onclick = () => {
                try { if (window.top && window.top !== window.self) { window.top.location.href = next; return; } } catch {}
                window.location.href = next;
              };
              document.body.innerHTML = "<div style='font-family:system-ui;padding:16px'>Still signing you in… If this page is embedded, tap Continue.</div>";
              document.body.appendChild(btn);
              return;
            }
            sessionStorage.setItem('GHANDOFF_TRIED_AT', String(now)); // record BEFORE calling redirect
            try {
              console.info('[handoff] Launch signInWithRedirect');
              await signInWithRedirect(auth, googleProvider);
            } catch (e) {
              console.warn('[handoff] signInWithRedirect error (fused):', e);
            }
          }
        }, 6000); // iOS patience
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML = '<pre>Auth error. Check console.</pre>';
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Signing you in…</div>;
}
