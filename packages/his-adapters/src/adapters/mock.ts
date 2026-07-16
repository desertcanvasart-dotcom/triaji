/**
 * Mock HIS Adapter
 *
 * Used in development and testing. Simulates a real HIS with realistic data.
 * Auto-generates slots for the next 14 days, with deterministic seeding
 * based on doctor ID so results are consistent.
 */

import type {
  HisAdapter,
  HisConnectionResult,
  HisDoctor,
  HisSlot,
  HisBookingRequest,
  HisBookingResult,
  HisCancelResult,
  HisIcuAvailability,
} from '../interface';
import type { HisAdapterConfig } from '../factory';

// Mock doctor names matching common specialties in Egyptian hospitals
const MOCK_DOCTORS: HisDoctor[] = [
  { hisDoctorId: 'HIS-D001', nameAr: 'د. أحمد عبد الرحمن', specialtyCode: 'CARD' },
  { hisDoctorId: 'HIS-D002', nameAr: 'د. محمد سيد إبراهيم', specialtyCode: 'CARD' },
  { hisDoctorId: 'HIS-D003', nameAr: 'د. فاطمة أحمد حسن', specialtyCode: 'DERM' },
  { hisDoctorId: 'HIS-D004', nameAr: 'د. علي محمود يوسف', specialtyCode: 'ORTH' },
  { hisDoctorId: 'HIS-D005', nameAr: 'د. مريم حسين عبد الله', specialtyCode: 'PEDI' },
  { hisDoctorId: 'HIS-D006', nameAr: 'د. خالد عبد العزيز', specialtyCode: 'ENT' },
  { hisDoctorId: 'HIS-D007', nameAr: 'د. نورا سمير محمد', specialtyCode: 'OPHT' },
  { hisDoctorId: 'HIS-D008', nameAr: 'د. عمر حسام الدين', specialtyCode: 'NEUR' },
  { hisDoctorId: 'HIS-D009', nameAr: 'د. هدى عبد الحميد', specialtyCode: 'GAST' },
  { hisDoctorId: 'HIS-D010', nameAr: 'د. يوسف كمال', specialtyCode: 'UROL' },
  { hisDoctorId: 'HIS-D011', nameAr: 'د. سارة إبراهيم', specialtyCode: 'OBGN' },
  { hisDoctorId: 'HIS-D012', nameAr: 'د. حسن محمد علي', specialtyCode: 'PULM' },
  { hisDoctorId: 'HIS-D013', nameAr: 'د. ريم عادل', specialtyCode: 'PSYC' },
  { hisDoctorId: 'HIS-D014', nameAr: 'د. طارق مصطفى', specialtyCode: 'ORTH' },
  { hisDoctorId: 'HIS-D015', nameAr: 'د. لمياء صالح', specialtyCode: 'DERM' },
  { hisDoctorId: 'HIS-D016', nameAr: 'د. إبراهيم حنفي', specialtyCode: 'SURG' },
  { hisDoctorId: 'HIS-D017', nameAr: 'د. منى عبد الكريم', specialtyCode: 'PEDI' },
  { hisDoctorId: 'HIS-D018', nameAr: 'د. وليد حسين', specialtyCode: 'CARD' },
  { hisDoctorId: 'HIS-D019', nameAr: 'د. أميرة شريف', specialtyCode: 'ENDO' },
  { hisDoctorId: 'HIS-D020', nameAr: 'د. سامح محمد', specialtyCode: 'RHEU' },
];

/** Slot times: morning, afternoon, evening */
const SLOT_TIMES = ['09:00', '12:00', '17:00'];

/**
 * Simple deterministic hash for consistent mock data.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** Track bookings in memory for the session */
const bookings = new Map<string, { ref: string; slotId: string; cancelled: boolean }>();

export class MockHisAdapter implements HisAdapter {
  readonly vendor = 'mock' as const;

  constructor(private _config: HisAdapterConfig) {}

  async testConnection(): Promise<HisConnectionResult> {
    return {
      success: true,
      message: 'Connected to Mock HIS (development)',
      version: 'mock-v1.0.0',
    };
  }

  async fetchDoctors(): Promise<HisDoctor[]> {
    return [...MOCK_DOCTORS];
  }

  async fetchAvailability(
    hisDoctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<HisSlot[]> {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const slots: HisSlot[] = [];

    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current <= to) {
      const dayOfWeek = current.getDay();

      // Working days only: Saturday (6) through Thursday (4)
      // Friday (5) is off
      if (dayOfWeek !== 5) {
        for (const time of SLOT_TIMES) {
          const [hours, minutes] = time.split(':').map(Number);
          const slotDt = new Date(current);
          slotDt.setHours(hours ?? 9, minutes ?? 0, 0, 0);

          // Skip past slots
          if (slotDt <= new Date()) {
            continue;
          }

          const slotId = `HIS-S-${hisDoctorId}-${slotDt.toISOString().split('T')[0]}-${time?.replace(':', '')}`;

          // 20% of slots are unavailable (simulates existing bookings)
          const hash = simpleHash(`${slotId}-avail`);
          const isAvailable = hash % 5 !== 0; // 80% available

          // Check if this slot was booked via our mock
          const wasBooked = Array.from(bookings.values()).some(
            (b) => b.slotId === slotId && !b.cancelled
          );

          slots.push({
            hisSlotId: slotId,
            hisDoctorId,
            datetime: slotDt.toISOString(),
            durationMinutes: 30,
            isAvailable: isAvailable && !wasBooked,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  async createBooking(booking: HisBookingRequest): Promise<HisBookingResult> {
    const ref = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    bookings.set(ref, {
      ref,
      slotId: booking.hisSlotId,
      cancelled: false,
    });

    return {
      success: true,
      hisBookingRef: ref,
    };
  }

  async cancelBooking(hisBookingRef: string): Promise<HisCancelResult> {
    const booking = bookings.get(hisBookingRef);
    if (booking) {
      booking.cancelled = true;
    }
    return { success: true };
  }

  async getIcuAvailability(): Promise<HisIcuAvailability[]> {
    return [
      {
        hisUnitId: 'HIS-ICU-001',
        unitType: 'general_icu',
        totalBeds: 10,
        availableBeds: 3,
        lastUpdatedAt: new Date(),
      },
      {
        hisUnitId: 'HIS-ICU-002',
        unitType: 'cardiac_icu',
        totalBeds: 6,
        availableBeds: 1,
        lastUpdatedAt: new Date(),
      },
    ];
  }
}

// Export for tests
export { MOCK_DOCTORS, SLOT_TIMES };
