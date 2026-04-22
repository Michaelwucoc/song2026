import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisConnecting: Promise<void> | null = null;

type MemEntry = { expiresAtMs: number };
const mem = new Map<string, MemEntry>();

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() || null;
}

async function getRedis() {
  const url = getRedisUrl();
  if (!url) return null;
  if (redisClient) return redisClient;

  redisClient = createClient({ url });
  redisClient.on("error", () => {
    // Keep quiet; API will fallback to memory if connection fails.
  });

  if (!redisConnecting) {
    redisConnecting = redisClient
      .connect()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        redisConnecting = null;
      });
  }
  await redisConnecting;
  return redisClient;
}

export async function getCooldownRemainingSeconds(key: string) {
  const redis = await getRedis();
  if (redis) {
    try {
      const ttl = await redis.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch {
      // fall through
    }
  }

  const entry = mem.get(key);
  if (!entry) return 0;
  const remainingMs = entry.expiresAtMs - Date.now();
  if (remainingMs <= 0) {
    mem.delete(key);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export async function setCooldownIfNotExists(key: string, seconds: number) {
  const redis = await getRedis();
  if (redis) {
    try {
      const ok = await redis.set(key, "1", { NX: true, EX: seconds });
      return ok === "OK";
    } catch {
      // fall through
    }
  }

  const existing = mem.get(key);
  if (existing && existing.expiresAtMs > Date.now()) return false;
  mem.set(key, { expiresAtMs: Date.now() + seconds * 1000 });
  return true;
}

