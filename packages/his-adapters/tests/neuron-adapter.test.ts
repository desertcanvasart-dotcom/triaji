/**
 * Neuron Adapter — integration tests with mocked HTTP.
 * Verifies the adapter returns correct HIS interface shapes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeuronAdapter } from '../src/adapters/neuron.js';
import type { NeuronTokenCache } from '../src/adapters/neuron.js';
import type { HisAdapterConfig } from '../src/factory.js';
import { getAdapter } from '../src/factory.js';

// ─── Mock token cache ────────────────────────────────────────────────────────

class MockTokenCache implements NeuronTokenCache {
  private token: string | null = null;
  getTokenCalls = 0;
  setTokenCalls = 0;
  clearTokenCalls = 0;

  async getToken(_tenantId?: string, _vendor?: string): Promise<string | null> {
    this.getTokenCalls++;
    return this.token;
  }
  async setToken(_t: string, _v: string, token: string, _expiresIn?: number): Promise<void> {
    this.setTokenCalls++;
    this.token = token;
  }
  async clearToken(_tenantId?: string, _vendor?: string): Promise<void> {
    this.clearTokenCalls++;
    this.token = null;
  }
}

// ─── Test helpers ────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.hospital.test/neuron';

function makeConfig(): HisAdapterConfig {
  return {
    vendor: 'neuron',
    baseUrl: BASE_URL,
    authType: 'oauth2',
    credentials: {
      clientId: 'test-client',
      clientSecret: 'test-secret',
    },
    tenantId: 'test-tenant',
  };
}

function mockFetchResponses(responses: Map<string, { status: number; body: unknown }>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    // Token endpoint
    if (urlStr.includes('/oauth/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'mock-bearer-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find matching mock
    for (const [pattern, resp] of responses.entries()) {
      if (urlStr.includes(pattern)) {
        return new Response(JSON.stringify(resp.body), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NeuronAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('is returned by factory for neuron vendor', () => {
    const adapter = getAdapter(makeConfig());
    expect(adapter).toBeInstanceOf(NeuronAdapter);
    expect(adapter.vendor).toBe('neuron');
  });

  describe('testConnection', () => {
    it('returns success on valid response', async () => {
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/system/status', { status: 200, body: { status: 'ok', version: '2.5.1', server_time: '2026-03-13T10:00:00Z' } }],
        ])
      );

      const cache = new MockTokenCache();
      const adapter = new NeuronAdapter(makeConfig(), cache);
      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected to Neuron HIS');
      expect(result.version).toBe('2.5.1');
    });

    it('returns failure on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

      const adapter = new NeuronAdapter(makeConfig());
      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network unreachable');
    });
  });

  describe('fetchDoctors', () => {
    it('returns mapped HisDoctor[] shape', async () => {
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/staff/doctors', {
            status: 200,
            body: [
              { doctor_id: 101, name_ar: 'د. أحمد محمود', name_en: 'Dr. Ahmed', specialty_code: 'CARD', department_id: 5, active: true },
              { doctor_id: 102, name_ar: 'د. سارة حسن', specialty_code: 'DERM', active: true },
              { doctor_id: 103, name_ar: 'د. غير نشط', specialty_code: 'ORTH', active: false },
            ],
          }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), new MockTokenCache());
      const doctors = await adapter.fetchDoctors();

      // Should filter out inactive doctors
      expect(doctors).toHaveLength(2);

      expect(doctors[0]).toEqual({
        hisDoctorId: '101',
        nameAr: 'د. أحمد محمود',
        nameEn: 'Dr. Ahmed',
        specialtyCode: 'CARD',
        departmentId: '5',
      });

      expect(doctors[1]).toEqual({
        hisDoctorId: '102',
        nameAr: 'د. سارة حسن',
        nameEn: undefined,
        specialtyCode: 'DERM',
        departmentId: undefined,
      });
    });
  });

  describe('createBooking', () => {
    it('returns success with HIS booking reference', async () => {
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/appointments/new', {
            status: 200,
            body: { appointment_id: 5001, status: 'confirmed', reference: 'NEU-5001' },
          }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), new MockTokenCache());
      const result = await adapter.createBooking({
        hisSlotId: 'neuron-101-16032026-0900',
        hisDoctorId: '101',
        patientNameAr: 'أحمد',
        patientPhone: '01012345678',
        triajiRef: 'booking-uuid-123',
      });

      expect(result.success).toBe(true);
      expect(result.hisBookingRef).toBe('NEU-5001');
    });

    it('returns failure on API error', async () => {
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/appointments/new', { status: 409, body: { error: 'Slot already booked' } }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), new MockTokenCache());
      const result = await adapter.createBooking({
        hisSlotId: 'slot-1',
        hisDoctorId: '101',
        patientNameAr: 'أحمد',
        patientPhone: '01012345678',
        triajiRef: 'ref-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('cancelBooking', () => {
    it('returns success on valid cancellation', async () => {
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/appointments/NEU-5001/cancel', { status: 200, body: { status: 'cancelled' } }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), new MockTokenCache());
      const result = await adapter.cancelBooking('NEU-5001', 'Patient request');

      expect(result.success).toBe(true);
    });
  });

  describe('token caching', () => {
    it('caches token on first request', async () => {
      const cache = new MockTokenCache();
      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/system/status', { status: 200, body: { status: 'ok', version: '2.0', server_time: '' } }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), cache);
      await adapter.testConnection();

      expect(cache.getTokenCalls).toBeGreaterThanOrEqual(1);
      expect(cache.setTokenCalls).toBe(1);
    });

    it('reuses cached token on subsequent requests', async () => {
      const cache = new MockTokenCache();
      // Pre-populate cache
      await cache.setToken('test-tenant', 'neuron', 'cached-token', 3600);
      cache.setTokenCalls = 0; // Reset counter

      globalThis.fetch = mockFetchResponses(
        new Map([
          ['/api/v2/system/status', { status: 200, body: { status: 'ok', version: '2.0', server_time: '' } }],
        ])
      );

      const adapter = new NeuronAdapter(makeConfig(), cache);
      await adapter.testConnection();

      // Should NOT have called setToken again (cache hit)
      expect(cache.setTokenCalls).toBe(0);
    });
  });
});
