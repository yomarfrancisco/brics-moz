// Embed mode utilities for Memberstack → Webflow → Vercel integration

const KEY = "brics.member";
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function getEmbedParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    embed: q.get("embed") === "1",
    uid: q.get("uid") || "",
    email: q.get("email") || "",
    sig: q.get("sig") || "",
  };
}

export function saveMember(uid: string, email: string, sig?: string) {
  const payload = { uid, email, sig, ts: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadMember() {
  try {
    const data = localStorage.getItem(KEY);
    if (!data) return null;
    const obj = JSON.parse(data);
    if (Date.now() - obj.ts > TTL) {
      localStorage.removeItem(KEY);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function validSig(sig?: string) {
  return !!sig && /^[0-9a-f]{64}$/i.test(sig);
}

export function isEmbedded() {
  try {
    return typeof window !== "undefined" && window.top !== window.self;
  } catch {
    // cross-origin access throws → definitely embedded
    return true;
  }
}
