/**
 * OAuth2 Token Cache — generic, used by any HIS adapter needing OAuth2.
 * Stores tokens in Redis with TTL = expires_in - 60 seconds buffer.
 * Falls back gracefully if Redis is unavailable.
 */

import { redis } from '@/lib/cache/redis';

const KEY_PREFIX = 'his:token:';
const EXPIRY_BUFFER_SECONDS = 60;

export class TokenCache {
  private keyFor(tenantId: string, vendor: string): string {
    return `${KEY_PREFIX}${vendor}:${tenantId}`;
  }

  async getToken(tenantId: string, vendor: string): Promise<string | null> {
    try {
      const token = await redis.get(this.keyFor(tenantId, vendor));
      return typeof token === 'string' ? token : null;
    } catch (err) {
      console.warn('[TokenCache] Redis get failed, will re-fetch token:', err);
      return null;
    }
  }

  async setToken(
    tenantId: string,
    vendor: string,
    token: string,
    expiresIn: number
  ): Promise<void> {
    const ttl = Math.max(expiresIn - EXPIRY_BUFFER_SECONDS, 30);
    try {
      await redis.set(this.keyFor(tenantId, vendor), token, { ex: ttl });
    } catch (err) {
      console.warn('[TokenCache] Redis set failed:', err);
    }
  }

  async clearToken(tenantId: string, vendor: string): Promise<void> {
    try {
      await redis.del(this.keyFor(tenantId, vendor));
    } catch (err) {
      console.warn('[TokenCache] Redis del failed:', err);
    }
  }
}

export const tokenCache = new TokenCache();
