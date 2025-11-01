export type PayfastStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Minimal REST helper. No external deps required.
async function upstash(cmd: string[], abortSignal?: AbortSignal) {
  if (!URL || !TOKEN) return { ok: false as const, error: 'STORE_DISABLED' };
  const body = JSON.stringify(cmd);
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body,
    signal: abortSignal,
  });
  if (!res.ok) return { ok: false as const, error: `HTTP_${res.status}` };
  const data = await res.json();
  return { ok: true as const, data };
}

export async function storeSet(ref: string, payload: any) {
  // HSET payfast:<ref> field value
  return upstash(['HSET', `payfast:${ref}`, 'json', JSON.stringify(payload)]);
}

export async function storeGet(ref: string) {
  const r = await upstash(['HGET', `payfast:${ref}`, 'json']);
  if (!r.ok) return { ok: false as const, status: 'PENDING' as PayfastStatus, detail: r.error };
  const val = r.data?.result;
  if (!val) return { ok: true as const, status: 'PENDING' as PayfastStatus };
  try {
    const parsed = JSON.parse(val);
    return { ok: true as const, status: (parsed?.status ?? 'PENDING') as PayfastStatus, data: parsed };
  } catch {
    return { ok: true as const, status: 'PENDING' as PayfastStatus };
  }
}

export function storeEnabled() {
  return Boolean(URL && TOKEN);
}

