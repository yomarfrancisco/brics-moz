export default function DebugEnv() {
  const mask = (v) => v ? v.slice(0, 6) + '…' : '(missing)';
  return (
    <pre style={{ padding: 16, fontFamily: 'monospace' }}>
{JSON.stringify({
  href: typeof window !== 'undefined' ? window.location.href : '(SSR)',
  embedded: (() => { try { return window.self !== window.top; } catch { return true; } })(),
  VITE_FIREBASE_AUTH_DOMAIN: mask(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  VITE_FIREBASE_PROJECT_ID: mask(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  VITE_FIREBASE_API_KEY: mask(import.meta.env.VITE_FIREBASE_API_KEY),
  VITE_FIREBASE_APP_ID: mask(import.meta.env.VITE_FIREBASE_APP_ID)
}, null, 2)}
    </pre>
  );
}
