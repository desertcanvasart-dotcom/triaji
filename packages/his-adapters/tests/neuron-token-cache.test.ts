/**
 * Neuron Token Cache — unit tests.
 * Tests an in-memory token cache that follows the NeuronTokenCache interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NeuronTokenCache } from '../src/adapters/neuron.js';

/**
 * Simple in-memory token cache for testing — same interface as Redis-backed one.
 */
class InMemoryTokenCache implements NeuronTokenCache {
  private store = new Map<string, { token: string; expiresAt: number }>();

  async getToken(tenantId: string, vendor: string): Promise<string | null> {
    const key = `${vendor}:${tenantId}`;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.token;
  }

  async setToken(tenantId: string, vendor: string, token: string, expiresIn: number): Promise<void> {
    const key = `${vendor}:${tenantId}`;
    const ttl = Math.max(expiresIn - 60, 30);
    this.store.set(key, { token, expiresAt: Date.now() + ttl * 1000 });
  }

  async clearToken(tenantId: string, vendor: string): Promise<void> {
    const key = `${vendor}:${tenantId}`;
    this.store.delete(key);
  }

  /** Test helper: get store size */
  get size(): number {
    return this.store.size;
  }
}

describe('NeuronTokenCache (in-memory)', () => {
  let cache: InMemoryTokenCache;

  beforeEach(() => {
    cache = new InMemoryTokenCache();
  });

  it('returns null for missing token', async () => {
    const token = await cache.getToken('tenant-1', 'neuron');
    expect(token).toBeNull();
  });

  it('stores and retrieves a token', async () => {
    await cache.setToken('tenant-1', 'neuron', 'abc123', 3600);
    const token = await cache.getToken('tenant-1', 'neuron');
    expect(token).toBe('abc123');
  });

  it('isolates tokens by tenant', async () => {
    await cache.setToken('tenant-1', 'neuron', 'token-1', 3600);
    await cache.setToken('tenant-2', 'neuron', 'token-2', 3600);

    expect(await cache.getToken('tenant-1', 'neuron')).toBe('token-1');
    expect(await cache.getToken('tenant-2', 'neuron')).toBe('token-2');
  });

  it('isolates tokens by vendor', async () => {
    await cache.setToken('tenant-1', 'neuron', 'neuron-token', 3600);
    await cache.setToken('tenant-1', 'shifa', 'shifa-token', 3600);

    expect(await cache.getToken('tenant-1', 'neuron')).toBe('neuron-token');
    expect(await cache.getToken('tenant-1', 'shifa')).toBe('shifa-token');
  });

  it('clears a token', async () => {
    await cache.setToken('tenant-1', 'neuron', 'abc123', 3600);
    await cache.clearToken('tenant-1', 'neuron');

    const token = await cache.getToken('tenant-1', 'neuron');
    expect(token).toBeNull();
  });

  it('returns null for expired token', async () => {
    // Set token with very short TTL (expires_in = 61 → ttl = 1 second after 60s buffer)
    // We'll fake the expiry by manipulating time
    vi.useFakeTimers();

    await cache.setToken('tenant-1', 'neuron', 'short-lived', 90);
    // Token exists now
    expect(await cache.getToken('tenant-1', 'neuron')).toBe('short-lived');

    // Advance 31 seconds (TTL = max(90-60, 30) = 30 seconds)
    vi.advanceTimersByTime(31_000);

    // Token should be expired
    expect(await cache.getToken('tenant-1', 'neuron')).toBeNull();

    vi.useRealTimers();
  });

  it('applies minimum TTL of 30 seconds', async () => {
    vi.useFakeTimers();

    // expires_in = 50 → ttl = max(50-60, 30) = 30 seconds
    await cache.setToken('tenant-1', 'neuron', 'min-ttl', 50);

    // At 29 seconds — still valid
    vi.advanceTimersByTime(29_000);
    expect(await cache.getToken('tenant-1', 'neuron')).toBe('min-ttl');

    // At 31 seconds — expired
    vi.advanceTimersByTime(2_000);
    expect(await cache.getToken('tenant-1', 'neuron')).toBeNull();

    vi.useRealTimers();
  });

  it('overwrites existing token', async () => {
    await cache.setToken('tenant-1', 'neuron', 'old-token', 3600);
    await cache.setToken('tenant-1', 'neuron', 'new-token', 3600);

    expect(await cache.getToken('tenant-1', 'neuron')).toBe('new-token');
    expect(cache.size).toBe(1);
  });
});
