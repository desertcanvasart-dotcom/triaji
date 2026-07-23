/**
 * DoctorTrio API Client — shared between web and mobile apps.
 * Calls the same API routes with typed request/response shapes.
 */

export interface ChatResponse {
  response: string;
  isEmergency: boolean;
  sessionComplete: boolean;
  recommendation?: {
    doctors: DoctorSummary[];
    specialtyNameAr: string;
    urgencyLevel: string;
    summaryAr: string;
  };
  emergency?: {
    escalationType: string;
    reasonAr: string;
    instructionsAr: string;
  };
}

export interface DoctorSummary {
  id: string;
  nameAr: string;
  nameEn: string | null;
  specialtyNameAr: string;
  specialtyNameEn: string | null;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  rating: number | null;
  distanceKm: number | null;
  isTelehealth: boolean;
  insuranceAccepted: boolean;
}

export interface AvailableSlot {
  id: string;
  slotDatetime: string;
  durationMinutes: number;
  dayAr: string;
  dateAr: string;
  timeAr: string;
}

export interface BookingRequest {
  sessionId: string;
  doctorId: string;
  slotId: string;
  patientName: string;
  phoneNumber: string;
}

export interface BookingResponse {
  bookingId: string;
  appointmentDatetime: string;
  doctorNameAr: string;
  specialtyNameAr: string;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  confirmationSentTo: string;
  confirmationChannel: 'whatsapp' | 'sms' | 'both' | null;
  dateAr: string;
  timeAr: string;
}

export interface SessionSummary {
  session_id: string;
  chief_complaint_ar: string;
  symptoms_ar: string[];
  specialty_name_ar: string | null;
  urgency_level: string | null;
  doctor_name_ar: string | null;
  appointment_datetime: string | null;
  outcome: string;
  created_at: string;
  patient_notes_ar: string | null;
}

export interface HealthRecordSummary {
  id: string;
  record_type: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  analysed: boolean;
  summary_ar: string | null;
  summary_en: string | null;
  has_abnormal_values: boolean;
  requires_attention: boolean;
}

export interface TelehealthToken {
  token: string;
  wsUrl: string;
  roomName: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
}

export class DoctorTrioApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
      headers['Cookie'] = `patient-token=${token}`;
    }

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error ?? `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Session ──────────────────────────────────────────────────────────────

  async createSession(
    channel: string = 'app',
    tenantId?: string
  ): Promise<{ session: { id: string } }> {
    return this.request('/api/session', {
      method: 'POST',
      body: JSON.stringify({ patientId: null, channel, tenantId }),
    });
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  async sendMessage(
    sessionId: string,
    message: string,
    lang: 'ar' | 'en' = 'ar',
    imageUrls?: string[]
  ): Promise<ChatResponse> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, lang, imageUrls }),
    });
  }

  // ─── Bookings ─────────────────────────────────────────────────────────────

  async getDoctorSlots(doctorId: string): Promise<{ slots: AvailableSlot[] }> {
    return this.request(`/api/doctors/${doctorId}/slots`);
  }

  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    return this.request('/api/booking', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async getHistory(): Promise<{ sessions: SessionSummary[] }> {
    return this.request('/api/patient/history');
  }

  // ─── Health Records ───────────────────────────────────────────────────────

  async getRecords(): Promise<{ records: HealthRecordSummary[] }> {
    return this.request('/api/patient/records');
  }

  async uploadRecord(
    file: { uri: string; name: string; type: string },
    recordType: string
  ): Promise<{ record: HealthRecordSummary }> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    formData.append('recordType', recordType);

    return this.request('/api/patient/records', {
      method: 'POST',
      body: formData,
    });
  }

  // ─── Generic helpers ──────────────────────────────────────────────────────

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  // ─── Medical Record ───────────────────────────────────────────────────────

  async getMedicalRecord<T = unknown>(): Promise<T> {
    return this.request<T>('/api/patient/medical-record');
  }

  // ─── Vitals ───────────────────────────────────────────────────────────────

  async saveVitals(vitals: Record<string, unknown>): Promise<{ success: boolean }> {
    return this.request('/api/patient/vitals', {
      method: 'POST',
      body: JSON.stringify(vitals),
    });
  }

  // ─── Telehealth ───────────────────────────────────────────────────────────

  async getTelehealthToken(
    bookingId: string,
    role: 'patient' | 'doctor' = 'patient'
  ): Promise<TelehealthToken> {
    return this.request(`/api/telehealth/token?bookingId=${bookingId}&role=${role}`);
  }

  // ─── Voice ────────────────────────────────────────────────────────────────

  async transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      name: 'recording.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);

    return this.request('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async requestOtp(phone: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/patient/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(
    phone: string,
    otp: string
  ): Promise<{ success: boolean; patientId: string; nameAr: string }> {
    return this.request('/api/patient/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  }

  // ─── Push Token ───────────────────────────────────────────────────────────

  async registerPushToken(expoPushToken: string): Promise<{ success: boolean }> {
    return this.request('/api/patient/push-token', {
      method: 'POST',
      body: JSON.stringify({ expoPushToken }),
    });
  }
}
