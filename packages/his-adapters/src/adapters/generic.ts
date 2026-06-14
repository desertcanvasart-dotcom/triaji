/**
 * Generic REST Adapter
 *
 * For hospitals with custom HIS APIs that don't match Shifa's structure.
 * Field-mapping driven — the tenant configures which fields in their API
 * response map to Triaji's interface via the fieldMapping config.
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

/**
 * Default field mapping — overridden by config.fieldMapping.
 */
const DEFAULT_FIELD_MAP: Record<string, string> = {
  doctor_id: 'id',
  doctor_name_ar: 'name_ar',
  doctor_name_en: 'name_en',
  specialty_code: 'specialty_code',
  department_id: 'department_id',
  slot_id: 'id',
  slot_doctor_id: 'doctor_id',
  slot_datetime: 'datetime',
  slot_duration: 'duration_minutes',
  is_available: 'is_available',
  available_value: 'true',
  booking_ref: 'booking_ref',
  ping_endpoint: '/api/ping',
  doctors_endpoint: '/api/doctors',
  availability_endpoint: '/api/doctors/:id/slots',
  booking_endpoint: '/api/appointments',
  cancel_endpoint: '/api/appointments/:ref/cancel',
};

function getField(mapping: Record<string, string>, key: string): string {
  return mapping[key] ?? DEFAULT_FIELD_MAP[key] ?? key;
}

function extractValue(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export class GenericRestAdapter implements HisAdapter {
  readonly vendor = 'generic_rest' as const;
  private mapping: Record<string, string>;

  constructor(private config: HisAdapterConfig) {
    this.mapping = { ...DEFAULT_FIELD_MAP, ...(config.fieldMapping ?? {}) };
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const timeout = this.config.timeout ?? 15000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.authType === 'api_key' && this.config.credentials.apiKey) {
      headers['X-API-Key'] = this.config.credentials.apiKey;
      headers['Authorization'] = `Bearer ${this.config.credentials.apiKey}`;
    } else if (this.config.authType === 'basic') {
      const user = this.config.credentials.username ?? '';
      const pass = this.config.credentials.password ?? '';
      headers['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options?.headers as Record<string, string>) },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `HIS API error ${response.status}: ${errorBody || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`HIS API timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  async testConnection(): Promise<HisConnectionResult> {
    try {
      const endpoint = getField(this.mapping, 'ping_endpoint');
      await this.request(endpoint);
      return { success: true, message: 'Connected to HIS' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async fetchDoctors(): Promise<HisDoctor[]> {
    const endpoint = getField(this.mapping, 'doctors_endpoint');
    const data = await this.request<Record<string, unknown>[]>(endpoint);

    return data.map((d) => ({
      hisDoctorId: String(extractValue(d, getField(this.mapping, 'doctor_id')) ?? ''),
      nameAr: String(extractValue(d, getField(this.mapping, 'doctor_name_ar')) ?? ''),
      nameEn: extractValue(d, getField(this.mapping, 'doctor_name_en')) as string | undefined,
      specialtyCode: String(extractValue(d, getField(this.mapping, 'specialty_code')) ?? ''),
      departmentId: extractValue(d, getField(this.mapping, 'department_id')) as string | undefined,
    }));
  }

  async fetchAvailability(
    hisDoctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<HisSlot[]> {
    const endpoint = getField(this.mapping, 'availability_endpoint')
      .replace(':id', hisDoctorId);
    const url = `${endpoint}?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
    const data = await this.request<Record<string, unknown>[]>(url);

    const availableValue = getField(this.mapping, 'available_value');

    return data
      .filter((s) => {
        const val = extractValue(s, getField(this.mapping, 'is_available'));
        return String(val) === availableValue || val === true;
      })
      .map((s) => ({
        hisSlotId: String(extractValue(s, getField(this.mapping, 'slot_id')) ?? ''),
        hisDoctorId: String(
          extractValue(s, getField(this.mapping, 'slot_doctor_id')) ?? hisDoctorId
        ),
        datetime: String(extractValue(s, getField(this.mapping, 'slot_datetime')) ?? ''),
        durationMinutes: Number(extractValue(s, getField(this.mapping, 'slot_duration')) ?? 30),
        isAvailable: true,
      }));
  }

  async createBooking(booking: HisBookingRequest): Promise<HisBookingResult> {
    try {
      const endpoint = getField(this.mapping, 'booking_endpoint');
      const data = await this.request<Record<string, unknown>>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          slot_id: booking.hisSlotId,
          doctor_id: booking.hisDoctorId,
          patient_name: booking.patientNameAr,
          patient_phone: booking.patientPhone,
          notes: booking.notes ?? '',
          external_ref: booking.triajiRef,
        }),
      });
      const ref = extractValue(data, getField(this.mapping, 'booking_ref'));
      return {
        success: true,
        hisBookingRef: String(ref ?? ''),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Booking failed',
      };
    }
  }

  async cancelBooking(hisBookingRef: string, reason?: string): Promise<HisCancelResult> {
    try {
      const endpoint = getField(this.mapping, 'cancel_endpoint')
        .replace(':ref', hisBookingRef);
      await this.request(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason ?? 'Cancelled' }),
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Cancel failed',
      };
    }
  }

  async getIcuAvailability(): Promise<HisIcuAvailability[]> {
    return []; // TODO: Implement when generic REST ICU endpoints are configured
  }
}
