// ─── Patient Profile Enums ───────────────────────────────────────────────────

export type BiologicalSex = 'male' | 'female';

export type WorkType =
  | 'office'
  | 'manual_construction'
  | 'healthcare'
  | 'education'
  | 'transportation'
  | 'agriculture'
  | 'retail_sales'
  | 'industrial_factory'
  | 'domestic'
  | 'student'
  | 'retired'
  | 'unemployed'
  | 'other';

export type WorkSchedule = 'day' | 'night' | 'irregular';

export type ActivityLevel = 'low' | 'moderate' | 'high';

export type SmokingStatus = 'never' | 'current' | 'former';

// ─── Medical Condition Enums ─────────────────────────────────────────────────

export type BPStatus = 'none' | 'controlled' | 'uncontrolled' | 'unknown';

export type DiabetesType = 'none' | 'type1' | 'type2' | 'unknown';

export type DiabetesControl = 'controlled' | 'uncontrolled' | 'unknown' | 'na';

export type DiabetesTreatment = 'tablets' | 'insulin' | 'both' | 'none' | 'na';

export type ConditionStatus = 'none' | 'known' | 'unknown';

// ─── Risk & Triage Enums ─────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export type UrgencyLevel = 'routine' | 'urgent' | 'emergency';

export type EscalationType =
  | 'emergency_room'
  | 'call_ambulance'
  | 'urgent_same_day';

// ─── Tenant & Platform Enums ─────────────────────────────────────────────────

export type TenantTier = 'platform' | 'basic' | 'premium';

// ─── Session Enums ───────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'completed' | 'escalated' | 'abandoned';

export type SessionChannel =
  | 'app'
  | 'website_widget'
  | 'hospital_kiosk'
  | 'api';

export type MessageRole = 'ai' | 'patient';

// ─── Booking Enums ───────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type BookingSource = 'native' | 'his_api';

export type ConfirmChannel = 'whatsapp' | 'sms' | 'both';

// ─── Knowledge Base Enums ────────────────────────────────────────────────────

export type KBCollection =
  | 'conditions'
  | 'symptoms'
  | 'specialty_map'
  | 'emergency_protocols'
  | 'egypt_context'
  | 'risk_modifiers'
  | 'follow_up_questions';

// ─── HIS Integration Enums ──────────────────────────────────────────────────

export type HisVendor = 'shifa' | 'neuron' | 'custom';

export type HisAuthType = 'api_key' | 'oauth2' | 'basic';
