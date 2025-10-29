// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDHdh_wvuIYK3ZFw-U2l2XKZzFW13KqUDc",
  authDomain: "brics-da7ba.firebaseapp.com",
  projectId: "brics-da7ba",
  appId: "1:738066241948:web:PASTE_APP_ID", // Will be filled from Firebase console
}

export function getFirebaseAuth() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // Persist across tabs and reloads
  setPersistence(auth, browserLocalPersistence)
  return auth
}
