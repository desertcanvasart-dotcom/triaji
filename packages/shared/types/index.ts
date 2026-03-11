// ─── Enums ───────────────────────────────────────────────────────────────────
export type {
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
} from './enums';

// ─── Patient ─────────────────────────────────────────────────────────────────
export type {
  Patient,
  PatientProfile,
  TriageSession,
  SessionMessage,
} from './patient';

// ─── Doctor ──────────────────────────────────────────────────────────────────
export type {
  Specialty,
  Doctor,
  DoctorAvailability,
  DoctorRating,
} from './doctor';

// ─── Booking ─────────────────────────────────────────────────────────────────
export type {
  Booking,
  BookingSlot,
  BookingConfirmation,
} from './booking';

// ─── Knowledge Base ──────────────────────────────────────────────────────────
export type {
  KBDocument,
  KBEmbedding,
  EmergencyTrigger,
} from './knowledge';

// ─── Tenant ──────────────────────────────────────────────────────────────────
export type {
  GovernorateRegion,
  Governorate,
  Tenant,
  TenantConfig,
  HisIntegration,
} from './tenant';
