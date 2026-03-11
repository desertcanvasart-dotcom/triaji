// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Enums
  BiologicalSex,
  WorkType,
  WorkSchedule,
  ActivityLevel,
  SmokingStatus,
  BPStatus,
  DiabetesType,
  DiabetesControl,
  DiabetesTreatment,
  ConditionStatus,
  RiskLevel,
  TenantTier,
  SessionStatus,
  UrgencyLevel,
  SessionChannel,
  BookingStatus,
  BookingSource,
  ConfirmChannel,
  MessageRole,
  KBCollection,
  EscalationType,
  HisVendor,
  HisAuthType,

  // Patient
  Patient,
  PatientProfile,
  TriageSession,
  SessionMessage,

  // Doctor
  Specialty,
  Doctor,
  DoctorAvailability,
  DoctorRating,

  // Booking
  Booking,
  BookingSlot,
  BookingConfirmation,

  // Knowledge
  KBDocument,
  KBEmbedding,
  EmergencyTrigger,

  // Tenant
  GovernorateRegion,
  Governorate,
  Tenant,
  TenantConfig,
  HisIntegration,
} from './types/index';

// ─── Supabase ────────────────────────────────────────────────────────────────
export { createBrowserClient, createServerClient } from './supabase/client';

// ─── Constants ───────────────────────────────────────────────────────────────
export {
  GOVERNORATES,
  getGovernorateByCode,
  getGovernoratesByRegion,
  type GovernorateEntry,
  SPECIALTIES,
  getSpecialtyByNameEn,
  getSpecialtyByNameAr,
  type SpecialtyEntry,
  TRIAGE_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from './constants/index';
