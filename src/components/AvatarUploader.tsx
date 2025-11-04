import React, { useRef, useState, useEffect } from "react";
import { auth, storage, db } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useWallet } from "../lib/useWallet";

interface AvatarUploaderProps {
  userId?: string;
}

export function AvatarUploader({ userId }: AvatarUploaderProps) {
  // Use cached avatarURL from useWallet to prevent flicker
  const { avatarURL: cachedAvatarURL } = useWallet();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(cachedAvatarURL);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  // Sync with cached value from useWallet
  useEffect(() => {
    if (cachedAvatarURL) {
      setAvatarUrl(cachedAvatarURL);
      setLoading(false);
    }
  }, [cachedAvatarURL]);

  // Load existing avatar from Firestore (background update)
  useEffect(() => {
    const loadAvatar = async () => {
      const user = auth.currentUser;
      const uid = userId || user?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.avatarURL) {
            // Only update if different to avoid flicker
            if (data.avatarURL !== avatarUrl) {
              setAvatarUrl(data.avatarURL);
            }
          }
        }
      } catch (err) {
        console.error("[AvatarUploader] Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAvatar();
  }, [userId]);

  const pickFile = () => {
    if (!auth.currentUser && !userId) {
      alert("You must be signed in to upload an avatar.");
      return;
    }
    fileInput.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB.");
      return;
    }

    const user = auth.currentUser;
    const uid = userId || user?.uid;
    if (!uid) {
      alert("You must be signed in.");
      return;
    }

    try {
      setUploading(true);

      const storageRef = ref(storage, `avatars/${uid}/avatar.jpg`);
      await uploadBytes(storageRef, file, { contentType: file.type });

      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", uid), {
        avatarURL: url,
        avatarSource: "custom",
        updatedAt: serverTimestamp(),
      });

      setAvatarUrl(url);
      
      // Update localStorage cache
      try {
        const LS_KEY = 'brics.profile';
        const cached = localStorage.getItem(LS_KEY);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(LS_KEY, JSON.stringify({
          ...parsed,
          avatarURL: url,
        }));
      } catch (e) {
        console.warn('[AvatarUploader] Failed to update cache:', e);
      }
    } catch (err) {
      console.error("[AvatarUploader] Upload error:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  const placeholderSvg = (
    <svg className="generic-avatar-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  );

  return (
    <div>
      <button
        onClick={pickFile}
        disabled={uploading || loading}
        aria-label="Upload avatar"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: uploading || loading ? "wait" : "pointer",
          opacity: uploading || loading ? 0.6 : 1,
        }}
      >
        <div className="generic-avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            placeholderSvg
          )}
        </div>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />
    </div>
  );
}

