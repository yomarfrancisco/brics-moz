// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  databaseURL: (import.meta as any).env.VITE_FIREBASE_DATABASE_URL
}

export function getFirebaseAuth() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // Persist across tabs and reloads
  setPersistence(auth, browserLocalPersistence)
  return auth
}
