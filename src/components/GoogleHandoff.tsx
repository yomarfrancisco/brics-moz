// src/components/GoogleHandoff.tsx
import '../lib/firebase';
import React, { useEffect } from 'react';
import { signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const ALLOWED_ORIGINS = [
  'https://brics.ninja',
  'https://buybrics.vercel.app',
  'https://brics-moz.vercel.app',
];

function sanitizeNext(next: string | null | undefined, fallback: string): string {
  try {
    if (!next) return fallback;
    if (next.startsWith('/')) return next; // same-origin path
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

        // 1) If Google already handed us a result, finish & escape.
        const result = await getRedirectResult(auth);
        if (result?.user) {
          try {
            if (window.parent && window.parent !== window.self) {
              window.parent.postMessage({ type: 'BRICS_AUTH', status: 'success', next }, '*');
            }
          } catch {}
          try {
            if (window.top && window.top !== window.self) {
              (window.top as Window).location.href = next;
              return;
            }
          } catch {}
          window.location.replace(next);
          return;
        }

        // 2) Fallback: iOS/webviews may hydrate user slightly later.
        let completed = false;
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u && !completed) {
            completed = true;
            try {
              if (window.parent && window.parent !== window.self) {
                window.parent.postMessage({ type: 'BRICS_AUTH', status: 'success', next }, '*');
              }
            } catch {}
            try {
              if (window.top && window.top !== window.self) {
                (window.top as Window).location.href = next;
                return;
              }
            } catch {}
            window.location.replace(next);
          }
        });

        const now = Date.now();
        const lastTried = Number(sessionStorage.getItem('GHANDOFF_TRIED_AT') || '0');
        const recentlyTried = now - lastTried < 30000; // 30s fuse

        // 3) After a grace period, attempt redirect exactly once.
        window.setTimeout(async () => {
          unsubscribe();

          if (!auth.currentUser && !completed) {
            if (recentlyTried) {
              // Stuck: inform parent + render manual escape (user gesture)
              try {
                if (window.parent && window.parent !== window.self) {
                  window.parent.postMessage({ type: 'BRICS_AUTH', status: 'stuck', next }, '*');
                }
              } catch {}

              const container = document.createElement('div');
              container.style.fontFamily = 'system-ui';
              container.style.padding = '16px';
              container.innerHTML = `<div>Still signing you in… If this page is embedded, tap Continue.</div>`;
              const btn = document.createElement('button');
              btn.textContent = 'Continue';
              btn.style.marginTop = '12px';
              btn.style.padding = '10px 14px';
              btn.style.borderRadius = '8px';
              btn.style.border = '1px solid #ddd';
              btn.onclick = () => {
                try {
                  if (window.parent && window.parent !== window.self) {
                    window.parent.postMessage({ type: 'BRICS_AUTH', status: 'success', next }, '*');
                  }
                } catch {}
                try {
                  if (window.top && window.top !== window.self) {
                    (window.top as Window).location.href = next; // user gesture → allowed on iOS
                    return;
                  }
                } catch {}
                window.location.href = next; // last resort
              };
              container.appendChild(btn);
              document.body.innerHTML = '';
              document.body.appendChild(container);
              return;
            }

            sessionStorage.setItem('GHANDOFF_TRIED_AT', String(now));
            try {
              await signInWithRedirect(auth, googleProvider);
            } catch (e) {
              console.warn('[handoff] signInWithRedirect error (fused):', e);
            }
          }
        }, 6000);
      } catch (e) {
        console.error('[handoff:error]', e);
        document.body.innerHTML = '<pre>Auth error. Check console.</pre>';
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Signing you in…</div>;
}
