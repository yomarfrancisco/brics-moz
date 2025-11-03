// Cross-runtime random helpers (browser + node/edge)

export function randHex(bytes: number = 16): string {
  if (typeof window === 'undefined') {
    // Server side (Node/Edge) – prefer Web Crypto if available
    // @ts-ignore
    const wc: Crypto | undefined = (globalThis as any).crypto;
    
    if (wc && typeof wc.getRandomValues === 'function') {
      const buf = new Uint8Array(bytes);
      wc.getRandomValues(buf);
      return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback to Node crypto if available
    try {
      // dynamic import to avoid bundling into client
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { randomBytes } = require('node:crypto');
      return randomBytes(bytes).toString('hex');
    } catch {
      // last resort (weak) – shouldn't happen on server
      const buf = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
      return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
    }
  } else {
    // Browser
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
}

export function randUUID(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  
  // compose from randHex to avoid polyfills
  const h = randHex(16);
  // RFC4122-ish (not strictly enforced)
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}

