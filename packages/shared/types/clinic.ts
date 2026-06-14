import type {
  QueueEntrySource,
  QueueEntryStatus,
  InvoiceStatus,
  PaymentMethod,
} from './enums';

// ─── Clinic Rooms ───────────────────────────────────────────────────────────

export interface ClinicRoom {
  id: string;
  tenant_id: string;
  name_ar: string;
  name_en: string | null;
  doctor_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Walk-In Queue ──────────────────────────────────────────────────────────

export interface QueueEntry {
  id: string;
  tenant_id: string;
  doctor_id: string;
  queue_date: string;

  patient_id: string | null;
  patient_name_ar: string;
  patient_phone: string | null;

  queue_number: number;
  source: QueueEntrySource;
  status: QueueEntryStatus;
  booking_id: string | null;

  arrived_at: string;
  called_at: string | null;
  completed_at: string | null;
  wait_minutes_actual: number | null;

  chief_complaint_ar: string | null;
  internal_notes: string | null;
  created_at: string;
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description_ar: string;
  description_en?: string;
  qty: number;
  unit_price_egp: number;
}

export interface ClinicInvoice {
  id: string;
  tenant_id: string;
  queue_entry_id: string | null;
  booking_id: string | null;
  patient_id: string | null;
  patient_name_ar: string;
  doctor_id: string;
  invoice_date: string;
  invoice_number: string;

  line_items: InvoiceLineItem[];

  subtotal_egp: number;
  discount_egp: number;
  insurance_covered: number;
  patient_pays_egp: number;

  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  whatsapp_sent: boolean;

  notes_ar: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Clinic Tenant Config Extensions ────────────────────────────────────────

export type ClinicBookingMode = 'walk_in_only' | 'slots_only' | 'both';

export interface ClinicConfig {
  clinic_specialty_ar: string | null;
  clinic_specialty_en: string | null;
  num_doctors: number;
  has_walk_in_queue: boolean;
  queue_whatsapp_enabled: boolean;
  queue_sms_fallback: boolean;
  estimated_minutes_per_patient: number;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  clinic_floor_ar: string | null;
  clinic_phone: string | null;
  clinic_booking_mode: ClinicBookingMode;
}

// ─── Queue Position (public API response) ───────────────────────────────────

export interface QueuePositionResponse {
  queueNumber: number;
  position: number;
  estimatedWaitMinutes: number;
  status: QueueEntryStatus;
}

// ─── Daily Summary ──────────────────────────────────────────────────────────

export interface DailySummary {
  date: string;
  totalInvoices: number;
  totalRevenue: number;
  byPaymentMethod: Array<{
    method: PaymentMethod;
    count: number;
    total: number;
  }>;
  pendingInvoices: number;
}
