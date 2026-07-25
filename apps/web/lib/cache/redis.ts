/**
 * Re-export of the shared Redis client.
 * The implementation moved to `@triaji/shared` so the admin panel can use the
 * same instance; this shim keeps the existing `@/lib/cache/redis` imports working.
 */

export { getRedis, redis } from '@triaji/shared/lib/cache/redis';
