import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  browserPopupRedirectResolver, // ⟵ REQUIRED for popup/redirect when using initializeAuth
} from 'firebase/auth';

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

// Durable → fallback → last-resort session (iOS/private/webviews)
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  popupRedirectResolver: browserPopupRedirectResolver, // ⟵ wire up popup/redirect methods
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.info('[firebase:init]', { name: app.name, projectId: cfg.projectId });
export { app, auth, googleProvider };
