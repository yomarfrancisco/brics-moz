// api/redis.ts
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// Helpers with JSON safety
export const rSetJSON = async (key: string, value: unknown, ttlSec?: number) => {
  const payload = JSON.stringify(value);
  return ttlSec ? redis.set(key, payload, { ex: ttlSec }) : redis.set(key, payload);
};

export const rGetJSON = async <T = unknown>(key: string): Promise<T | null> => {
  const raw = await redis.get<string | null>(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null as any;
  }
};

// Namespacing (new canonical)
export const pf = {
  pay: (ref: string) => `pf:pay:${ref}`,
  log: (stamp?: number) => `pf:log:${stamp ?? Date.now()}`,
  pending: (ref: string) => `pf:pending:${ref}`,
};

// Balance helpers
export const balKey = (uid: string) => `wallet:bal:zar:${uid}`;

export async function getBalance(uid: string): Promise<number> {
  return (await redis.get<number>(balKey(uid))) ?? 0;
}

export async function credit(uid: string, amount: number): Promise<number> {
  await redis.incrbyfloat(balKey(uid), amount);
  return await getBalance(uid);
}

