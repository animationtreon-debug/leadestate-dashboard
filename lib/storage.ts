/**
 * Hybrid storage: uses Upstash Redis when env vars are present (Vercel/production),
 * falls back to local JSON files for development.
 */
import { promises as fs } from "fs";
import path from "path";

type JsonValue = Record<string, unknown>;

// Lazy-init Redis client so it doesn't crash in dev when vars are absent
let _redis: import("@upstash/redis").Redis | null = null;
function getRedis(): import("@upstash/redis").Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");
    _redis = Redis.fromEnv() as import("@upstash/redis").Redis;
  }
  return _redis;
}

function filePath(key: string): string {
  return path.join(process.cwd(), "data", `${key}.json`);
}

export async function storageGet<T extends JsonValue>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    return redis.get<T>(key);
  }
  try {
    const raw = await fs.readFile(filePath(key), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function storageSet<T extends JsonValue>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, value);
    return;
  }
  const fp = filePath(key);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(value, null, 2));
}
