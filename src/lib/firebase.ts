// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

console.log('[firebase:init]', {
  name: app.name,
  authDomain: cfg.authDomain ? cfg.authDomain.slice(0,8)+'…' : '(missing)',
  projectId: cfg.projectId ? cfg.projectId.slice(0,8)+'…' : '(missing)'
});

export { app, auth, googleProvider };
