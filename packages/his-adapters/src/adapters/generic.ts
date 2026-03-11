import type { HisAdapter } from '../interface.js';
import type { HisSlot, HisBooking, HisDoctor } from '../types.js';

export class GenericAdapter implements HisAdapter {
  fetchSlots(_doctorId: string, _from: Date, _to: Date): Promise<HisSlot[]> {
    throw new Error('Generic adapter not yet implemented');
  }

  bookSlot(_slotId: string, _patientData: Record<string, string>): Promise<HisBooking> {
    throw new Error('Generic adapter not yet implemented');
  }

  cancelBooking(_bookingId: string): Promise<boolean> {
    throw new Error('Generic adapter not yet implemented');
  }

  syncDoctors(): Promise<HisDoctor[]> {
    throw new Error('Generic adapter not yet implemented');
  }

  testConnection(): Promise<boolean> {
    throw new Error('Generic adapter not yet implemented');
  }
}
