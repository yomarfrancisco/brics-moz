import type { VercelRequest, VercelResponse } from '@vercel/node';

const URL = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!URL || !TOKEN) {
      return res.status(500).json({ ok: false, error: 'missing_upstash_env' });
    }

    const key = `diag:vercel:${Date.now()}`;
    const value = JSON.stringify({ t: Date.now(), from: 'vercel-prod' });

    // Write
    const setResp = await fetch(`${URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    const setJson = await setResp.json().catch(() => ({}));

    // Read back
    const getResp = await fetch(`${URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const getJson = await getResp.json().catch(() => ({}));

    return res.status(200).json({
      ok: true,
      url: URL,
      wrote: setJson,
      read: getJson,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

