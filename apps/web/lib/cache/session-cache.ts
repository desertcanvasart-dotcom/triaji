/**
 * Session State Cache — Redis-backed
 * Caches active triage session state to reduce Supabase reads
 * during multi-turn conversations.
 *
 * - TTL: 2 hours (longer than any realistic triage session)
 * - Write-through: writes go to Supabase (source of truth) + Redis
 * - Read: Redis first, fallback to Supabase on cache miss
 * - Invalidate: on session completion or booking creation
 */

import { redis } from '@/lib/cache/redis';
import type { TriageSession } from '@triaji/shared/types';

const SESSION_CACHE_TTL = 7200; // 2 hours in seconds
const KEY_PREFIX = 'session:';

function cacheKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

/**
 * Get a cached session state. Returns null on cache miss.
 */
export async function getCachedSession(sessionId: string): Promise<TriageSession | null> {
  try {
    const raw = await redis.get<string>(cacheKey(sessionId));
    if (!raw) return null;

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed as TriageSession;
  } catch (err) {
    console.error('[SessionCache] Failed to read cache:', err);
    return null;
  }
}

/**
 * Cache a session state in Redis.
 */
export async function cacheSession(session: TriageSession): Promise<void> {
  try {
    await redis.set(cacheKey(session.id), JSON.stringify(session), {
      ex: SESSION_CACHE_TTL,
    });
  } catch (err) {
    // Cache write failures are non-fatal — Supabase is the source of truth
    console.error('[SessionCache] Failed to write cache:', err);
  }
}

/**
 * Update cached session with partial data. Merges with existing cache.
 */
export async function updateCachedSession(
  sessionId: string,
  updates: Partial<TriageSession>
): Promise<void> {
  try {
    const existing = await getCachedSession(sessionId);
    if (!existing) return; // No cache to update

    const merged = { ...existing, ...updates };
    await redis.set(cacheKey(sessionId), JSON.stringify(merged), {
      ex: SESSION_CACHE_TTL,
    });
  } catch (err) {
    console.error('[SessionCache] Failed to update cache:', err);
  }
}

/**
 * Invalidate (delete) a cached session.
 * Called when session completes, is escalated, or booking is created.
 */
export async function invalidateSessionCache(sessionId: string): Promise<void> {
  try {
    await redis.del(cacheKey(sessionId));
  } catch (err) {
    console.error('[SessionCache] Failed to invalidate cache:', err);
  }
}
