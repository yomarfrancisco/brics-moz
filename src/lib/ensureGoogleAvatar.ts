import { User } from "firebase/auth";
import { db, storage } from "./firebase";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const AVATAR_PATH = (uid: string) => `avatars/${uid}/avatar.jpg`;

async function fetchGooglePhotoBlob(photoURL: string): Promise<Blob> {
  // Ask for a decent size; Google accepts sz=
  const url = photoURL.includes("?") ? `${photoURL}&sz=512` : `${photoURL}?sz=512`;
  const resp = await fetch(url, { mode: "cors" });
  if (!resp.ok) throw new Error(`Failed to fetch Google photo: ${resp.status}`);
  return await resp.blob();
}

/**
 * Ensure a user has an avatar in Storage + Firestore.
 * Only runs if users/{uid}.avatarURL is missing OR avatarSource !== 'custom'.
 * Will NOT overwrite if avatarSource === 'custom'.
 */
export async function ensureGoogleAvatar(user: User) {
  if (!user?.uid) return;
  
  const uid = user.uid;
  const photoURL = user.photoURL; // comes from Google provider for Google sign-in
  
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  // Create base user doc if missing
  if (!snap.exists()) {
    await setDoc(userRef, {
      balanceZAR: 0,
      createdAt: serverTimestamp(),
    });
  }
  
  const data = snap.data() || {};
  const hasCustom = data?.avatarSource === "custom";
  const alreadySet = !!data?.avatarURL;
  
  // Respect user uploads: never overwrite custom avatar
  if (hasCustom && alreadySet) return;
  
  // If no google photo available, bail (keep placeholder)
  if (!photoURL) return;
  
  // Download from Google and upload to Storage
  const blob = await fetchGooglePhotoBlob(photoURL);
  
  // Basic guard: images only and < 5MB to match rules
  if (!(blob.type || "").startsWith("image/")) return;
  if (blob.size > 5 * 1024 * 1024) return;
  
  const storageRef = ref(storage, AVATAR_PATH(uid));
  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  const url = await getDownloadURL(storageRef);
  
  await updateDoc(userRef, {
    avatarURL: url,
    avatarSource: "google",
    updatedAt: serverTimestamp(),
  });
  
  return url;
}

