import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redis, rSetJSON, rGetJSON, pf } from "../redis.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1) ping
    const ping = await redis.ping();

    // 2) write a test value with TTL 60s
    const key = pf.log(Date.now());
    await rSetJSON(key, { ok: true, when: new Date().toISOString() }, 60);

    // 3) read it back
    const back = await rGetJSON(key);

    // 4) list ~10 recent pf:log via scanIterator
    const recent: string[] = [];
    for await (const k of redis.scanIterator({ match: "pf:log:*", count: 50 })) {
      recent.push(k as string);
      if (recent.length >= 10) break;
    }

    res.status(200).json({ ping, wrote: key, readBack: back, recent });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}

