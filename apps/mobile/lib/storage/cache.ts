/**
 * Offline Cache Helper — stores JSON data with timestamps in MMKV.
 * Used by medical record and other screens to show cached data when offline.
 */

import { storage } from '../storage';

const CACHE_PREFIX = 'cache:';
const TS_PREFIX = 'cache-ts:';

/**
 * Store JSON data with a timestamp in MMKV.
 */
export function cacheData(key: string, data: unknown): void {
  try {
    storage.set(CACHE_PREFIX + key, JSON.stringify(data));
    storage.set(TS_PREFIX + key, Date.now());
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Check whether cached data exists and is still fresh.
 */
export function isCacheValid(key: string, maxAgeHours: number): boolean {
  const ts = storage.getNumber(TS_PREFIX + key);
  if (ts == null) return false;
  const ageMs = Date.now() - ts;
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}

/**
 * Return cached data if it exists and is within maxAgeHours, otherwise null.
 */
export function getCachedData<T = unknown>(
  key: string,
  maxAgeHours: number
): T | null {
  if (!isCacheValid(key, maxAgeHours)) return null;

  const raw = storage.getString(CACHE_PREFIX + key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Clear a specific cache entry.
 */
export function clearCache(key: string): void {
  storage.delete(CACHE_PREFIX + key);
  storage.delete(TS_PREFIX + key);
}
