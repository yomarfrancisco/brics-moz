import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, rSetJSON, rGetJSON, pf } from "../redis.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // 1) ping
    const ping = await redis.ping();

    // 2) write a test value with TTL 60s
    const key = pf.log(Date.now());
    await rSetJSON(key, { ok: true, when: new Date().toISOString() }, 60);

    // 3) read it back
    const back = await rGetJSON(key);

    // 4) list ~10 recent pf:log via scan
    const scanResult = await redis.scan(0, { match: "pf:log:*", count: 50 });
    const recent: string[] = (scanResult[1] as string[]).slice(-10);

    res.status(200).json({ ping, wrote: key, readBack: back, recent });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}

