/**
 * Neuron Schedule Grid → Available Slots — unit tests.
 * Tests the pure computation logic with no HTTP calls.
 */

import { describe, it, expect } from 'vitest';
import { NeuronAdapter } from '../src/adapters/neuron.js';
import type { NeuronScheduleGrid, NeuronBookedSlot } from '../src/adapters/neuron.js';

function makeSchedule(overrides?: Partial<NeuronScheduleGrid>): NeuronScheduleGrid {
  return {
    doctor_id: 101,
    working_days: [0, 1, 2, 3, 4, 6], // Sun-Thu + Sat (no Friday)
    working_hours: { start: '09:00', end: '17:00' },
    slot_duration: 30,
    ...overrides,
  };
}

describe('NeuronAdapter.computeAvailableSlots', () => {
  it('generates correct number of slots for a single working day', () => {
    // Monday 2026-03-16 → 09:00-17:00 in 30min slots = 16 slots
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule();
    const booked: NeuronBookedSlot[] = [];

    const slots = NeuronAdapter.computeAvailableSlots(schedule, booked, from, to);
    expect(slots.length).toBe(16);

    // First slot at 09:00
    expect(slots[0].datetime).toContain('T09:00:00');
    // Last slot at 16:30
    expect(slots[slots.length - 1].datetime).toContain('T16:30:00');
  });

  it('excludes booked slots', () => {
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule();
    const booked: NeuronBookedSlot[] = [
      { appointment_id: 1, doctor_id: 101, date: '16/03/2026', time: '09:00' },
      { appointment_id: 2, doctor_id: 101, date: '16/03/2026', time: '10:30' },
      { appointment_id: 3, doctor_id: 101, date: '16/03/2026', time: '14:00' },
    ];

    const slots = NeuronAdapter.computeAvailableSlots(schedule, booked, from, to);
    expect(slots.length).toBe(13); // 16 - 3

    // Verify booked times are not present
    const times = slots.map((s) => {
      const d = new Date(s.datetime);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    expect(times).not.toContain('09:00');
    expect(times).not.toContain('10:30');
    expect(times).not.toContain('14:00');
  });

  it('skips Fridays even if listed in working_days', () => {
    const from = new Date(2026, 2, 20); // Friday
    const to = new Date(2026, 2, 20);
    const schedule = makeSchedule({ working_days: [0, 1, 2, 3, 4, 5, 6] }); // All days

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    expect(slots.length).toBe(0);
  });

  it('skips non-working days', () => {
    // Only working on Mon (1) and Wed (3)
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 22); // Sun
    const schedule = makeSchedule({ working_days: [1, 3] });

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    // Mon (16 slots) + Wed (16 slots) = 32
    expect(slots.length).toBe(32);
  });

  it('handles multi-day range correctly', () => {
    // Mon to Wed = 3 working days × 16 slots
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 18); // Wed
    const schedule = makeSchedule();

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    expect(slots.length).toBe(48); // 3 × 16
  });

  it('handles different slot durations', () => {
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule({ slot_duration: 60 }); // 1-hour slots

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    expect(slots.length).toBe(8); // 09:00-17:00 in 1h = 8 slots
  });

  it('handles overlapping bookings across multiple days', () => {
    const from = new Date(2026, 2, 16); // Mon
    const to = new Date(2026, 2, 17); // Tue
    const schedule = makeSchedule();
    const booked: NeuronBookedSlot[] = [
      { appointment_id: 1, doctor_id: 101, date: '16/03/2026', time: '09:00' },
      { appointment_id: 2, doctor_id: 101, date: '17/03/2026', time: '09:00' },
    ];

    const slots = NeuronAdapter.computeAvailableSlots(schedule, booked, from, to);
    expect(slots.length).toBe(30); // 32 - 2
  });

  it('all slots are marked available', () => {
    const from = new Date(2026, 2, 16);
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule();

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    for (const slot of slots) {
      expect(slot.isAvailable).toBe(true);
    }
  });

  it('slot IDs are deterministic', () => {
    const from = new Date(2026, 2, 16);
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule();

    const slots1 = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    const slots2 = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);

    expect(slots1.map((s) => s.hisSlotId)).toEqual(slots2.map((s) => s.hisSlotId));
    expect(slots1[0].hisSlotId).toBe('neuron-101-16032026-0900');
  });

  it('carries clinicId from schedule', () => {
    const from = new Date(2026, 2, 16);
    const to = new Date(2026, 2, 16);
    const schedule = makeSchedule({ clinic_id: 'clinic-A' });

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    for (const slot of slots) {
      expect(slot.clinicId).toBe('clinic-A');
    }
  });

  it('returns empty array for zero working days', () => {
    const from = new Date(2026, 2, 16);
    const to = new Date(2026, 2, 22);
    const schedule = makeSchedule({ working_days: [] });

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    expect(slots.length).toBe(0);
  });

  it('handles edge-of-day slots correctly', () => {
    const from = new Date(2026, 2, 16);
    const to = new Date(2026, 2, 16);
    // Working hours: 08:00 - 08:30 → exactly 1 slot
    const schedule = makeSchedule({
      working_hours: { start: '08:00', end: '08:30' },
    });

    const slots = NeuronAdapter.computeAvailableSlots(schedule, [], from, to);
    expect(slots.length).toBe(1);
    expect(slots[0].datetime).toContain('T08:00:00');
  });
});
