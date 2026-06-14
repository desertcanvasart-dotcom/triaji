import type { BookingStatus, BookingSource, ConfirmChannel } from './enums';

// ─── Booking ─────────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  tenant_id: string;
  patient_id: string;
  doctor_id: string;
  session_id: string | null;
  slot_id: string | null;
  his_booking_ref: string | null;
  appointment_datetime: string;
  duration_minutes: number;
  status: BookingStatus;
  booking_source: BookingSource;
  confirmation_sent_at: string | null;
  confirmation_channel: ConfirmChannel | null;
  appointment_type: 'in_person' | 'telehealth';
  livekit_room_name: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  call_duration_seconds: number | null;
  notes_ar: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Booking Slot ────────────────────────────────────────────────────────────

export interface BookingSlot {
  id: string;
  doctor_id: string;
  availability_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  booking_id: string | null;
}

// ─── Booking Confirmation ────────────────────────────────────────────────────

export interface BookingConfirmation {
  id: string;
  booking_id: string;
  channel: ConfirmChannel;
  sent_at: string;
  delivered_at: string | null;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  message_id_external: string | null;
}
