/**
 * Mock HIS server data — mimics Shifa API response shapes.
 */

export const MOCK_HIS_DOCTORS = [
  { doctor_id: 'HIS-D001', doctor_name_ar: 'د. أحمد عبد الرحمن', doctor_name_en: 'Dr. Ahmed Abdelrahman', specialty_code: 'CARD', department_id: 'DEPT-1' },
  { doctor_id: 'HIS-D002', doctor_name_ar: 'د. محمد سيد إبراهيم', doctor_name_en: 'Dr. Mohamed Sayed', specialty_code: 'CARD', department_id: 'DEPT-1' },
  { doctor_id: 'HIS-D003', doctor_name_ar: 'د. فاطمة أحمد حسن', doctor_name_en: 'Dr. Fatma Ahmed', specialty_code: 'DERM', department_id: 'DEPT-2' },
  { doctor_id: 'HIS-D004', doctor_name_ar: 'د. علي محمود يوسف', doctor_name_en: 'Dr. Ali Mahmoud', specialty_code: 'ORTH', department_id: 'DEPT-3' },
  { doctor_id: 'HIS-D005', doctor_name_ar: 'د. مريم حسين عبد الله', doctor_name_en: 'Dr. Maryam Hussein', specialty_code: 'PEDI', department_id: 'DEPT-4' },
];

export function generateSlots(doctorId: string, fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const slots: Array<{
    slot_id: string;
    doctor_id: string;
    start_datetime: string;
    duration_minutes: number;
    available: boolean;
    clinic_id: string;
  }> = [];

  const current = new Date(from);
  current.setHours(0, 0, 0, 0);

  const times = ['09:00', '12:00', '17:00'];

  while (current <= to) {
    if (current.getDay() !== 5) { // Skip Friday
      for (const time of times) {
        const [h, m] = time.split(':').map(Number);
        const dt = new Date(current);
        dt.setHours(h ?? 9, m ?? 0, 0, 0);

        if (dt <= new Date()) continue;

        const slotId = `HIS-S-${doctorId}-${dt.toISOString().split('T')[0]}-${time.replace(':', '')}`;
        const hash = slotId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const available = hash % 5 !== 0;

        slots.push({
          slot_id: slotId,
          doctor_id: doctorId,
          start_datetime: dt.toISOString(),
          duration_minutes: 30,
          available,
          clinic_id: 'CLINIC-1',
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

// In-memory bookings
export const hisBookings = new Map<string, {
  booking_ref: string;
  slot_id: string;
  doctor_id: string;
  patient_name_ar: string;
  patient_phone: string;
  status: string;
  external_ref: string;
}>();
