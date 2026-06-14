/**
 * Neuron HIS Adapter
 *
 * Neuron Health Systems is the second most widely deployed HIS in Egyptian
 * private hospitals after Shifa. Common in mid-size private hospitals and
 * specialist clinics across Cairo and Alexandria.
 *
 * Key differences from Shifa:
 * - Authentication: Bearer token (OAuth2 client credentials flow)
 * - Date format: DD/MM/YYYY HH:mm (not ISO 8601 — normalised on input)
 * - Doctor IDs: integer IDs (stored as string)
 * - Slot availability: schedule grid + booked slots — Triaji computes available slots
 *
 * IMPORTANT: Endpoint paths are placeholders based on Neuron API conventions.
 * Update with actual endpoints when Neuron API docs are available.
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

// ─── Neuron API endpoints ────────────────────────────────────────────────────

const NEURON_ENDPOINTS = {
  token: '/oauth/token',
  ping: '/api/v2/system/status',
  doctors: '/api/v2/staff/doctors',
  schedule: '/api/v2/appointments/schedule',
  booked: '/api/v2/appointments/booked',
  createBooking: '/api/v2/appointments/new',
  cancelBooking: '/api/v2/appointments/:id/cancel',
} as const;

// ─── Neuron response types ───────────────────────────────────────────────────

interface NeuronTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface NeuronStatusResponse {
  status: string;
  version: string;
  server_time: string;
}

interface NeuronDoctorResponse {
  doctor_id: number;
  name_ar: string;
  name_en?: string;
  specialty_code: string;
  department_id?: number;
  active: boolean;
}

export interface NeuronScheduleGrid {
  doctor_id: number;
  working_days: number[]; // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  working_hours: { start: string; end: string }; // "09:00", "17:00"
  slot_duration: number; // minutes
  clinic_id?: string;
}

export interface NeuronBookedSlot {
  appointment_id: number;
  doctor_id: number;
  date: string; // DD/MM/YYYY
  time: string; // HH:mm
  patient_name?: string;
}

interface NeuronBookingResponse {
  appointment_id: number;
  status: string;
  reference: string;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Format Date as DD/MM/YYYY for Neuron API */
function toNeuronDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Parse ISO date string to Date (for fromDate/toDate params) */
function parseIsoDate(isoStr: string): Date {
  return new Date(isoStr);
}

// ─── Token cache interface ───────────────────────────────────────────────────

export interface NeuronTokenCache {
  getToken(tenantId: string, vendor: string): Promise<string | null>;
  setToken(tenantId: string, vendor: string, token: string, expiresIn: number): Promise<void>;
  clearToken(tenantId: string, vendor: string): Promise<void>;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class NeuronAdapter implements HisAdapter {
  readonly vendor = 'neuron' as const;
  private tokenCache: NeuronTokenCache | null;

  constructor(
    private config: HisAdapterConfig,
    tokenCache?: NeuronTokenCache
  ) {
    this.tokenCache = tokenCache ?? null;
  }

  // ─── OAuth2 token management ─────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache) {
      const cached = await this.tokenCache.getToken(this.config.tenantId, 'neuron');
      if (cached) return cached;
    }

    const tokenUrl = this.config.credentials.tokenUrl
      ? this.config.credentials.tokenUrl
      : `${this.config.baseUrl.replace(/\/$/, '')}${NEURON_ENDPOINTS.token}`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.credentials.clientId ?? '',
      client_secret: this.config.credentials.clientSecret ?? '',
    });

    const timeout = this.config.timeout ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Neuron token exchange failed (${response.status}): ${errBody}`);
      }

      const data = (await response.json()) as NeuronTokenResponse;

      if (this.tokenCache) {
        await this.tokenCache.setToken(
          this.config.tenantId,
          'neuron',
          data.access_token,
          data.expires_in
        );
      }

      return data.access_token;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Neuron token exchange timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  // ─── Base request helper ─────────────────────────────────────────────────

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const timeout = this.config.timeout ?? 15000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(options?.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Token may have expired — clear cache and retry once
        if (this.tokenCache) {
          await this.tokenCache.clearToken(this.config.tenantId, 'neuron');
        }
        const newToken = await this.getAccessToken();
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${newToken}`,
            ...(options?.headers as Record<string, string> | undefined),
          },
        });

        if (!retryResponse.ok) {
          const errBody = await retryResponse.text().catch(() => '');
          throw new Error(`Neuron API error ${retryResponse.status}: ${errBody}`);
        }
        return (await retryResponse.json()) as T;
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Neuron API error ${response.status}: ${errBody || response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Neuron API timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  // ─── Interface implementations ───────────────────────────────────────────

  async testConnection(): Promise<HisConnectionResult> {
    try {
      const data = await this.request<NeuronStatusResponse>(NEURON_ENDPOINTS.ping);
      return {
        success: true,
        message: 'Connected to Neuron HIS',
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
    const data = await this.request<NeuronDoctorResponse[]>(NEURON_ENDPOINTS.doctors);
    return data
      .filter((d) => d.active)
      .map((d) => ({
        hisDoctorId: String(d.doctor_id),
        nameAr: d.name_ar,
        nameEn: d.name_en,
        specialtyCode: d.specialty_code,
        departmentId: d.department_id != null ? String(d.department_id) : undefined,
      }));
  }

  async fetchAvailability(
    hisDoctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<HisSlot[]> {
    const from = parseIsoDate(fromDate);
    const to = parseIsoDate(toDate);
    const neuronFrom = toNeuronDate(from);
    const neuronTo = toNeuronDate(to);

    const [schedule, booked] = await Promise.all([
      this.request<NeuronScheduleGrid>(
        `${NEURON_ENDPOINTS.schedule}?doctor_id=${hisDoctorId}&from=${encodeURIComponent(neuronFrom)}&to=${encodeURIComponent(neuronTo)}`
      ),
      this.request<NeuronBookedSlot[]>(
        `${NEURON_ENDPOINTS.booked}?doctor_id=${hisDoctorId}&from=${encodeURIComponent(neuronFrom)}&to=${encodeURIComponent(neuronTo)}`
      ),
    ]);

    return NeuronAdapter.computeAvailableSlots(schedule, booked, from, to);
  }

  /**
   * Compute available slots by subtracting booked from the schedule grid.
   * Public static for testability.
   */
  static computeAvailableSlots(
    schedule: NeuronScheduleGrid,
    booked: NeuronBookedSlot[],
    from: Date,
    to: Date
  ): HisSlot[] {
    const slots: HisSlot[] = [];

    const bookedSet = new Set<string>();
    for (const b of booked) {
      bookedSet.add(`${b.date}|${b.time}`);
    }

    const startParts = schedule.working_hours.start.split(':').map(Number);
    const endParts = schedule.working_hours.end.split(':').map(Number);
    const startHour = startParts[0] ?? 0;
    const startMin = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMin = endParts[1] ?? 0;
    const slotDuration = schedule.slot_duration || 30;

    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();

      // Skip if not a working day
      if (!schedule.working_days.includes(dayOfWeek)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Skip Fridays (Egyptian weekend)
      if (dayOfWeek === 5) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      const dateStr = toNeuronDate(current);
      let slotHour = startHour;
      let slotMin = startMin;

      while (
        slotHour < endHour ||
        (slotHour === endHour && slotMin < endMin)
      ) {
        const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
        const isBooked = bookedSet.has(`${dateStr}|${timeStr}`);

        if (!isBooked) {
          // Build local ISO datetime string (appointment times are local to the hospital)
          const dd = String(current.getDate()).padStart(2, '0');
          const mm = String(current.getMonth() + 1).padStart(2, '0');
          const yyyy = current.getFullYear();
          const localDatetime = `${yyyy}-${mm}-${dd}T${timeStr}:00`;

          const slotId = `neuron-${schedule.doctor_id}-${dateStr.replace(/\//g, '')}-${timeStr.replace(':', '')}`;

          slots.push({
            hisSlotId: slotId,
            hisDoctorId: String(schedule.doctor_id),
            datetime: localDatetime,
            durationMinutes: slotDuration,
            isAvailable: true,
            clinicId: schedule.clinic_id,
          });
        }

        slotMin += slotDuration;
        while (slotMin >= 60) {
          slotMin -= 60;
          slotHour++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  async createBooking(booking: HisBookingRequest): Promise<HisBookingResult> {
    try {
      const data = await this.request<NeuronBookingResponse>(
        NEURON_ENDPOINTS.createBooking,
        {
          method: 'POST',
          body: JSON.stringify({
            doctor_id: Number(booking.hisDoctorId),
            slot_id: booking.hisSlotId,
            patient_name: booking.patientNameAr,
            patient_phone: booking.patientPhone,
            notes: booking.notes ?? '',
            external_reference: booking.triajiRef,
          }),
        }
      );

      return {
        success: true,
        hisBookingRef: data.reference ?? String(data.appointment_id),
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
      const path = NEURON_ENDPOINTS.cancelBooking.replace(':id', hisBookingRef);
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
    return []; // TODO: Implement when Neuron exposes ICU API
  }
}
