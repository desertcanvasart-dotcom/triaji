export interface HisSlot {
  id: string;
  doctorId: string;
  datetime: string;
  durationMinutes: number;
  available: boolean;
}

export interface HisBooking {
  id: string;
  patientRef: string;
  doctorRef: string;
  slotRef: string;
  status: string;
  confirmationRef: string | null;
}

export interface HisDoctor {
  id: string;
  nameAr: string;
  specialtyCode: string;
  available: boolean;
}
