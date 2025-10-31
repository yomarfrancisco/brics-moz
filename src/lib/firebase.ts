import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Make persistence explicit (helps Safari/iOS)
export const authReady = setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();

// Runtime verification: log exact Firebase config to verify app matching
console.log('[firebase:init]', {
  name: app.name,
  appId: firebaseConfig.appId || '(missing)',
  authDomain: firebaseConfig.authDomain || '(missing)',
  projectId: firebaseConfig.projectId || '(missing)',
  storageBucket: firebaseConfig.storageBucket || '(missing)',
  messagingSenderId: firebaseConfig.messagingSenderId || '(missing)',
  apiKeyPrefix: firebaseConfig.apiKey ? firebaseConfig.apiKey.slice(0, 10) + '…' : '(missing)',
  initializedFrom: getApps().length > 0 ? 'existing' : 'new'
});
