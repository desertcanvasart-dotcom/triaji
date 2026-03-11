import type { HisSlot, HisBooking, HisDoctor } from './types.js';

export interface HisAdapter {
  fetchSlots(doctorId: string, from: Date, to: Date): Promise<HisSlot[]>;
  bookSlot(slotId: string, patientData: Record<string, string>): Promise<HisBooking>;
  cancelBooking(bookingId: string): Promise<boolean>;
  syncDoctors(): Promise<HisDoctor[]>;
  testConnection(): Promise<boolean>;
}
