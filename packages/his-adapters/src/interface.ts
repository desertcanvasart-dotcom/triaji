/**
 * HIS Adapter Interface
 * Every HIS vendor adapter must implement this interface exactly.
 * Adding a new vendor = creating a new class that implements HisAdapter.
 */

export interface HisAdapter {
  readonly vendor: HisVendor;

  /** Test the connection to the HIS. Called when admin saves credentials. */
  testConnection(): Promise<HisConnectionResult>;

  /** Fetch all doctors registered in the HIS for this tenant. */
  fetchDoctors(): Promise<HisDoctor[]>;

  /**
   * Fetch available appointment slots for a specific doctor.
   * @param hisDoctorId - The doctor's ID in the HIS system
   * @param fromDate    - Start of date range (ISO string)
   * @param toDate      - End of date range (ISO string)
   */
  fetchAvailability(
    hisDoctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<HisSlot[]>;

  /** Create a booking in the HIS. Called after Triaji validates and reserves the slot. */
  createBooking(booking: HisBookingRequest): Promise<HisBookingResult>;

  /** Cancel a booking in the HIS. Called when admin or patient cancels. */
  cancelBooking(hisBookingRef: string, reason?: string): Promise<HisCancelResult>;

  // ICU bed availability (optional — not all HIS systems expose this)
  getIcuAvailability?(): Promise<HisIcuAvailability[]>;
}

export type HisVendor = 'shifa' | 'neuron' | 'generic_rest' | 'mock';

export interface HisConnectionResult {
  success: boolean;
  message: string;
  version?: string;
}

export interface HisDoctor {
  hisDoctorId: string;
  nameAr: string;
  nameEn?: string;
  specialtyCode: string;
  departmentId?: string;
}

export interface HisSlot {
  hisSlotId: string;
  hisDoctorId: string;
  datetime: string; // ISO 8601
  durationMinutes: number;
  isAvailable: boolean;
  clinicId?: string;
}

export interface HisBookingRequest {
  hisSlotId: string;
  hisDoctorId: string;
  patientNameAr: string;
  patientPhone: string;
  notes?: string;
  triajiRef: string; // Triaji booking UUID — for cross-reference
}

export interface HisBookingResult {
  success: boolean;
  hisBookingRef?: string;
  error?: string;
}

export interface HisCancelResult {
  success: boolean;
  error?: string;
}

export interface HisIcuAvailability {
  hisUnitId: string;
  unitType: string; // Maps to IcuUnitType
  totalBeds: number;
  availableBeds: number;
  lastUpdatedAt: Date;
}
