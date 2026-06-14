/**
 * Shifa HIS Adapter
 *
 * Shifa System is the most widely deployed HIS in Egyptian private hospitals.
 * REST-based API with API key authentication in the request header.
 *
 * IMPORTANT: These endpoint paths are placeholders based on typical HIS REST
 * conventions. Update with actual endpoints when Shifa API docs are available.
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

// SHIFA_ENDPOINTS — verify against Shifa API documentation
// These are placeholder paths based on typical HIS REST conventions.
// Update with actual endpoints when Shifa API docs are available.
const SHIFA_ENDPOINTS = {
  ping: '/api/v1/system/ping',
  doctors: '/api/v1/doctors',
  availability: '/api/v1/doctors/:id/slots',
  createBooking: '/api/v1/appointments',
  cancelBooking: '/api/v1/appointments/:ref/cancel',
} as const;

interface ShifaPingResponse {
  status: string;
  version: string;
}

interface ShifaDoctorResponse {
  doctor_id: string;
  doctor_name_ar: string;
  doctor_name_en?: string;
  specialty_code: string;
  department_id?: string;
}

interface ShifaSlotResponse {
  slot_id: string;
  doctor_id: string;
  start_datetime: string;
  duration_minutes: number;
  available: boolean;
  clinic_id?: string;
}

interface ShifaBookingResponse {
  booking_ref: string;
  status: string;
}

export class ShifaAdapter implements HisAdapter {
  readonly vendor = 'shifa' as const;

  constructor(private config: HisAdapterConfig) {}

  /**
   * Base request helper — handles auth header + error normalisation.
   */
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

    // Apply auth headers
    if (this.config.authType === 'api_key' && this.config.credentials.apiKey) {
      headers['X-API-Key'] = this.config.credentials.apiKey;
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
          `Shifa API error ${response.status}: ${errorBody || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Shifa API timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  async testConnection(): Promise<HisConnectionResult> {
    try {
      const data = await this.request<ShifaPingResponse>(SHIFA_ENDPOINTS.ping);
      return {
        success: true,
        message: `Connected to Shifa HIS`,
        version: data.version,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async fetchDoctors(): Promise<HisDoctor[]> {
    const data = await this.request<ShifaDoctorResponse[]>(SHIFA_ENDPOINTS.doctors);
    return data.map((d) => ({
      hisDoctorId: d.doctor_id,
      nameAr: d.doctor_name_ar,
      nameEn: d.doctor_name_en,
      specialtyCode: d.specialty_code,
      departmentId: d.department_id,
    }));
  }

  async fetchAvailability(
    hisDoctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<HisSlot[]> {
    const path = SHIFA_ENDPOINTS.availability.replace(':id', hisDoctorId);
    const url = `${path}?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
    const data = await this.request<ShifaSlotResponse[]>(url);

    return data
      .filter((s) => s.available)
      .map((s) => ({
        hisSlotId: s.slot_id,
        hisDoctorId: s.doctor_id,
        datetime: s.start_datetime,
        durationMinutes: s.duration_minutes,
        isAvailable: s.available,
        clinicId: s.clinic_id,
      }));
  }

  async createBooking(booking: HisBookingRequest): Promise<HisBookingResult> {
    try {
      const data = await this.request<ShifaBookingResponse>(
        SHIFA_ENDPOINTS.createBooking,
        {
          method: 'POST',
          body: JSON.stringify({
            slot_id: booking.hisSlotId,
            doctor_id: booking.hisDoctorId,
            patient_name_ar: booking.patientNameAr,
            patient_phone: booking.patientPhone,
            notes: booking.notes ?? '',
            external_ref: booking.triajiRef,
          }),
        }
      );
      return {
        success: true,
        hisBookingRef: data.booking_ref,
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
      const path = SHIFA_ENDPOINTS.cancelBooking.replace(':ref', hisBookingRef);
      await this.request(path, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason ?? 'Cancelled via Triaji' }),
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
    return []; // TODO: Implement when Shifa exposes ICU API
  }
}
