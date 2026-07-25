/**
 * Upstash Redis Client
 * Serverless Redis for OTP storage and session state caching.
 *
 * DEV_MODE: When UPSTASH_REDIS_REST_URL is not set, returns an in-memory
 * mock that behaves like Redis for local development.
 */

import { Redis } from '@upstash/redis';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MockStore {
  data: Map<string, { value: string; expiresAt: number | null }>;
}

// ─── Mock Redis for DEV_MODE ────────────────────────────────────────────────

function createMockRedis(): Redis {
  const store: MockStore = {
    data: new Map(),
  };

  function isExpired(key: string): boolean {
    const entry = store.data.get(key);
    if (!entry) return true;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      store.data.delete(key);
      return true;
    }
    return false;
  }

  const mock = {
    async get<T = string>(key: string): Promise<T | null> {
      if (isExpired(key)) return null;
      const entry = store.data.get(key);
      if (!entry) return null;
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return entry.value as unknown as T;
      }
    },

    async set(
      key: string,
      value: unknown,
      opts?: { ex?: number }
    ): Promise<string> {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
      store.data.set(key, { value: serialized, expiresAt });
      return 'OK';
    },

    async del(...keys: string[]): Promise<number> {
      let deleted = 0;
      for (const key of keys) {
        if (store.data.delete(key)) deleted++;
      }
      return deleted;
    },

    async exists(...keys: string[]): Promise<number> {
      let count = 0;
      for (const key of keys) {
        if (!isExpired(key) && store.data.has(key)) count++;
      }
      return count;
    },

    async incr(key: string): Promise<number> {
      if (isExpired(key)) {
        store.data.set(key, { value: '1', expiresAt: null });
        return 1;
      }
      const entry = store.data.get(key);
      const current = entry ? parseInt(entry.value, 10) || 0 : 0;
      const next = current + 1;
      store.data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
  };

  console.log('[Redis DEV_MODE] Using in-memory mock — no UPSTASH_REDIS_REST_URL set');
  return mock as unknown as Redis;
}

// ─── Redis Singleton ────────────────────────────────────────────────────────

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (redisInstance) return redisInstance;

  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];

  if (!url || !token) {
    redisInstance = createMockRedis();
    return redisInstance;
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

/** Convenience export for direct usage */
export const redis = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    const instance = getRedis();
    const value = instance[prop as keyof Redis];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
