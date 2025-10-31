import "../lib/firebase";
import React, { useEffect } from "react";
import { signInWithRedirect, getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

const ALLOWED_ORIGINS = [
  "https://brics.ninja",
  "https://www.brics.ninja",
  "https://buybrics.vercel.app",
  "https://brics-moz.vercel.app",
];

function sanitizeNext(next: string | null | undefined, fallback: string): string {
  try {
    if (!next) return fallback;
    if (next.startsWith("/")) return next; // same-origin path
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
          url.searchParams.get("next") ||
          sessionStorage.getItem("GHANDOFF_NEXT") ||
          "https://brics.ninja";
        const next = sanitizeNext(rawNext as string, "https://brics.ninja");
        console.info("[handoff] next:", next);

        // 1) If Google already handed us a result, finish.
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.info("[handoff] redirect result → user");
          try { window.parent !== window && window.parent.postMessage({ type: "BRICS_AUTH", status: "success", next }, "*"); } catch {}
          try {
            if (window.top && window.top !== window.self) {
              window.top.location.href = next;
              return;
            }
          } catch {}
          window.location.replace(next);
          return;
        }

        // 2) Fallback: wait for iOS to surface the user
        let completed = false;
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u && !completed) {
            completed = true;
            console.info("[handoff] onAuthStateChanged → user");
            try { window.parent !== window && window.parent.postMessage({ type: "BRICS_AUTH", status: "success", next }, "*"); } catch {}
            try {
              if (window.top && window.top !== window.self) {
                window.top.location.href = next;
                return;
              }
            } catch {}
            window.location.replace(next);
          }
        });

        const now = Date.now();
        const lastTried = Number(sessionStorage.getItem("GHANDOFF_TRIED_AT") || "0");
        const recentlyTried = now - lastTried < 30000; // 30s fuse

        // 3) After a grace period, attempt redirect exactly once
        window.setTimeout(async () => {
          unsubscribe();

          if (!auth.currentUser && !completed) {
            if (recentlyTried) {
              console.warn("[handoff] Skipping signInWithRedirect to avoid loop");
              try { window.parent !== window && window.parent.postMessage({ type: "BRICS_AUTH", status: "stuck", next }, "*"); } catch {}
              // Gesture-based fallback
              const a = document.createElement("a");
              a.href = next;
              a.textContent = "Continue";
              a.style.display = "inline-block";
              a.style.marginTop = "12px";
              a.style.padding = "10px 14px";
              a.style.borderRadius = "8px";
              a.style.border = "1px solid #ddd";
              a.style.backgroundColor = "#007bff";
              a.style.color = "#fff";
              a.style.textDecoration = "none";
              a.style.fontFamily = "system-ui";
              document.body.innerHTML =
                "<div style='font-family:system-ui;padding:16px'>Still signing you in… If this page is embedded in an app, tap continue to open in your browser.</div>";
              document.body.appendChild(a);
              return;
            }
            sessionStorage.setItem("GHANDOFF_TRIED_AT", String(now)); // record first
            try {
              console.info("[handoff] Launching Google signInWithRedirect");
              await signInWithRedirect(auth, googleProvider);
            } catch (e) {
              console.warn("[handoff] signInWithRedirect error (fused, will not loop):", e);
            }
          }
        }, 6000); // iOS patience
      } catch (e) {
        console.error("[handoff:error]", e);
        document.body.innerHTML = "<pre>Auth error. Check console.</pre>";
      }
    })();
  }, []);

  return <div style={{ padding: 16, fontFamily: "system-ui" }}>Signing you in…</div>;
}
