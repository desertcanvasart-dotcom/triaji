import { describe, it, expect } from 'vitest';
import { MockHisAdapter, MOCK_DOCTORS } from '../src/adapters/mock.js';
import type { HisAdapterConfig } from '../src/factory.js';

const mockConfig: HisAdapterConfig = {
  vendor: 'mock',
  baseUrl: 'http://localhost:4000',
  authType: 'api_key',
  credentials: { apiKey: 'test' },
  tenantId: 'test-tenant',
};

describe('MockHisAdapter', () => {
  const adapter = new MockHisAdapter(mockConfig);

  describe('testConnection', () => {
    it('returns success', async () => {
      const result = await adapter.testConnection();
      expect(result.success).toBe(true);
      expect(result.version).toBe('mock-v1.0.0');
    });
  });

  describe('fetchDoctors', () => {
    it('returns mock doctors', async () => {
      const doctors = await adapter.fetchDoctors();
      expect(doctors.length).toBe(MOCK_DOCTORS.length);
      expect(doctors.length).toBeGreaterThanOrEqual(20);
    });

    it('doctors have correct shape', async () => {
      const doctors = await adapter.fetchDoctors();
      const doc = doctors[0]!;
      expect(doc).toHaveProperty('hisDoctorId');
      expect(doc).toHaveProperty('nameAr');
      expect(doc).toHaveProperty('specialtyCode');
      expect(doc.hisDoctorId).toMatch(/^HIS-D\d+$/);
    });
  });

  describe('fetchAvailability', () => {
    it('returns slots for next 7 days', async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 7);

      const slots = await adapter.fetchAvailability(
        'HIS-D001',
        from.toISOString(),
        to.toISOString()
      );

      expect(slots.length).toBeGreaterThan(0);
    });

    it('slots have correct shape', async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 7);

      const slots = await adapter.fetchAvailability(
        'HIS-D001',
        from.toISOString(),
        to.toISOString()
      );

      const slot = slots[0]!;
      expect(slot).toHaveProperty('hisSlotId');
      expect(slot).toHaveProperty('hisDoctorId');
      expect(slot).toHaveProperty('datetime');
      expect(slot).toHaveProperty('durationMinutes');
      expect(slot).toHaveProperty('isAvailable');
      expect(slot.hisDoctorId).toBe('HIS-D001');
      expect(slot.durationMinutes).toBe(30);
    });

    it('skips Fridays', async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 14);

      const slots = await adapter.fetchAvailability(
        'HIS-D001',
        from.toISOString(),
        to.toISOString()
      );

      for (const slot of slots) {
        const dt = new Date(slot.datetime);
        expect(dt.getDay()).not.toBe(5); // Friday
      }
    });

    it('has approximately 20% unavailable slots', async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 14);

      const slots = await adapter.fetchAvailability(
        'HIS-D001',
        from.toISOString(),
        to.toISOString()
      );

      const total = slots.length;
      const unavailable = slots.filter((s) => !s.isAvailable).length;
      // Allow some variance: 10-30% unavailable
      const pct = (unavailable / total) * 100;
      expect(pct).toBeGreaterThanOrEqual(5);
      expect(pct).toBeLessThanOrEqual(40);
    });
  });

  describe('createBooking', () => {
    it('returns success with booking ref', async () => {
      const result = await adapter.createBooking({
        hisSlotId: 'HIS-S-test',
        hisDoctorId: 'HIS-D001',
        patientNameAr: 'محمد أحمد',
        patientPhone: '01012345678',
        triajiRef: 'test-uuid-123',
      });

      expect(result.success).toBe(true);
      expect(result.hisBookingRef).toMatch(/^MOCK-/);
    });

    it('booking ref format is MOCK-{timestamp}-{random}', async () => {
      const result = await adapter.createBooking({
        hisSlotId: 'HIS-S-test2',
        hisDoctorId: 'HIS-D002',
        patientNameAr: 'فاطمة محمد',
        patientPhone: '01112345678',
        triajiRef: 'test-uuid-456',
      });

      expect(result.hisBookingRef).toMatch(/^MOCK-\d+-[a-z0-9]+$/);
    });
  });

  describe('cancelBooking', () => {
    it('returns success', async () => {
      const booking = await adapter.createBooking({
        hisSlotId: 'HIS-S-cancel-test',
        hisDoctorId: 'HIS-D001',
        patientNameAr: 'أحمد علي',
        patientPhone: '01512345678',
        triajiRef: 'cancel-test',
      });

      const result = await adapter.cancelBooking(booking.hisBookingRef!);
      expect(result.success).toBe(true);
    });

    it('cancelling non-existent booking still succeeds', async () => {
      const result = await adapter.cancelBooking('non-existent-ref');
      expect(result.success).toBe(true);
    });
  });
});
