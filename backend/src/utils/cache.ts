import Redis from 'ioredis';

type CacheValue = unknown;

export interface CacheClient {
  get<T = CacheValue>(key: string): Promise<T | null>;
  set<T = CacheValue>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryCache implements CacheClient {
  private store = new Map<string, { value: CacheValue; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }
}

class RedisCache implements CacheClient {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { maxRetriesPerRequest: 2 });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}

let cacheClient: CacheClient | null = null;

export const getCacheClient = (): CacheClient => {
  if (cacheClient) return cacheClient;

  const driver = process.env.CACHE_DRIVER?.trim().toLowerCase();
  if (driver === 'memory') {
    cacheClient = new MemoryCache();
    return cacheClient;
  }

  if (driver === 'redis' || (!driver && process.env.REDIS_URL)) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is not set for CACHE_DRIVER=redis');
    }
    cacheClient = new RedisCache(redisUrl);
    return cacheClient;
  }

  cacheClient = new MemoryCache();
  return cacheClient;
};
