// ─── GP Video Call Types ─────────────────────────────────────────────────────

export type GpCallStatus =
  | 'initiated' | 'ringing' | 'accepted' | 'declined'
  | 'missed' | 'in_progress' | 'completed' | 'failed';

export type GpCallInitiator = 'doctor' | 'patient';

export interface GpVideoCall {
  id: string;
  gp_relationship_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  livekit_room_name: string;
  livekit_room_sid: string | null;
  initiator: GpCallInitiator;
  status: GpCallStatus;
  initiated_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  is_recorded: boolean;
  recording_consent_given: boolean;
  recording_url: string | null;
  recording_expires_at: string | null;
  transcription_status: string;
  transcription_ar: string | null;
  transcription_en: string | null;
  structured_notes_ar: string | null;
  is_paid: boolean;
  call_fee_egp: number;
  payment_transaction_id: string | null;
  post_call_health_record_id: string | null;
  end_reason: string | null;
  doctor_connection_quality: string | null;
  patient_connection_quality: string | null;
  created_at: string;
  updated_at: string;
}

export interface GpCallSettings {
  gp_video_call_fee_egp: number;
  gp_video_calls_enabled: boolean;
  max_call_duration_minutes: number;
  video_call_availability: Record<string, [string, string]>; // day → [start, end]
}

export interface GpAvailabilityResult {
  available: boolean;
  nextWindow?: string;
  reason?: string;
}
