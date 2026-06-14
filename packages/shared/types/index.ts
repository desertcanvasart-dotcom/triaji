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
  HandoffReason,
  CallEndReason,
  PregnancyStatus,
  MenopauseStatus,
  MenstrualRegularity,
  FamilyRelation,
  AllergyCategory,
  ClinicRole,
  QueueEntrySource,
  QueueEntryStatus,
  InvoiceStatus,
  PaymentMethod,
  LabRole,
  LabOrderStatus,
  LabAppointmentStatus,
  PharmacyRole,
  PrescriptionRoutingStatus,
  VitalType,
  VitalSource,
  FollowUpStatus,
  GPRequestStatus,
  GPRequestInitiator,
  ReferralStatus,
  ReferralTier,
  ConsentScope,
  InsuranceRole,
  PolicyStatus,
  PreauthStatus,
  ClaimStatus,
  ClaimType,
} from './enums';

// ─── Patient ─────────────────────────────────────────────────────────────────
export type {
  Patient,
  PatientProfile,
  TriageSession,
  SessionMessage,
  SessionSummary,
  HistoryConsent,
} from './patient';

// ─── Doctor ──────────────────────────────────────────────────────────────────
export type {
  Specialty,
  Doctor,
  DoctorAvailability,
  DoctorRating,
  MatchedDoctor,
  DoctorRecommendation,
  InsuranceProvider,
  DoctorInsurance,
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

// ─── Structured Profile ────────────────────────────────────────────────────
export type {
  AllergyOption,
  ChronicConditionOption,
  SurgeryOption,
  FamilyHistoryOption,
  PatientAllergy,
  PatientChronicCondition,
  PatientMedication,
  PatientSurgery,
  PatientFamilyHistory,
  StructuredPatientProfile,
  OnboardingPayload,
} from './profile-structured';

// ─── Clinic ────────────────────────────────────────────────────────────────
export type {
  ClinicRoom,
  QueueEntry,
  ClinicInvoice,
  InvoiceLineItem,
  ClinicConfig,
  ClinicBookingMode,
  QueuePositionResponse,
  DailySummary,
} from './clinic';

// ─── Lab & Radiology ───────────────────────────────────────────────────────
export type {
  LabService,
  LabTestCatalog,
  LabOrderRouting,
  LabAppointment,
  LabResultValue,
  LabResultUpload,
} from './lab';

// ─── Pharmacy ──────────────────────────────────────────────────────────────
export type {
  PharmacyMedication,
  MedicationCatalog,
  PrescriptionRouting,
  StockConfirmationItem,
  PharmacyInvoice,
  PharmacyInvoiceLineItem,
} from './pharmacy';

// ─── Longitudinal Intelligence ─────────────────────────────────────────────
export type {
  VitalEntry,
  FollowUpEntry,
  AdherenceRecord,
  VitalTrendPoint,
  MedicalRecordSummary,
} from './longitudinal';

// ─── Care Coordination ─────────────────────────────────────────────────────
export type {
  GPRelationship,
  GPNote,
  Referral,
  DiseaseProtocol,
  ProtocolDefinition,
  ProtocolEnrollment,
  RecordAccessGrant,
  ProtocolAlert,
  ProtocolLabTest,
  ProtocolVital,
  ProtocolTarget,
  ProtocolWarning,
} from './care-coordination';

// ─── Insurance ─────────────────────────────────────────────────────────────
export type {
  InsuranceCompany,
  PatientInsurancePolicy,
  PreAuthRequest,
  InsuranceClaim,
  ClaimLineItem,
  RemittanceRecord,
} from './insurance';

// ─── ICU ─────────────────────────────────────────────────────────────────
export type {
  IcuUnitType,
  IcuUpdateSource,
  TransferStatus,
  IcuUnit,
  IcuAvailabilityLogEntry,
  IcuTransferRequest,
  IcuSearchResult,
  HisIcuAvailability,
  StalenessLevel,
} from './icu';
export { getStalenessLevel } from './icu';

// ─── Interactions ──────────────────────────────────────────────────────────
export type {
  InteractionSeverity,
  InteractionResult,
  CheckResult,
  DrugInput,
  InteractionCheckRequest,
  InteractionOverride,
} from './interactions';

// ─── Paediatric ────────────────────────────────────────────────────────────
export type {
  GuardianRelation,
  GuardianRelationship,
  GrowthMeasurement,
  WhoGrowthReference,
  VaccineStatus,
  VaccineCatalog,
  VaccinationScheduleEntry,
  MilestoneCategory,
  MilestoneCatalog,
  PatientMilestone,
  SchoolHealthRecord,
  PaediatricDrugFormulation,
  PaediatricDrugDosing,
  ChildProfile,
} from './paediatric';
export { PAEDIATRIC_URGENCY } from './paediatric';

// ─── Payment ──────────────────────────────────────────────────────────────────
export type {
  PaymentProvider,
  PaymentStatus,
  PayableType,
  PaymentTransaction,
} from './payment';

// ─── Lab Chain ────────────────────────────────────────────────────────────────
export type {
  LabChainCode,
  LabChain,
  LabChainBranch,
  LabChainTestMapping,
  LabChainWebhook,
  LabChainSyncLog,
} from './lab-chain';

// ─── GP Video ──────────────────────────────────────────────────────────────
export type {
  GpCallStatus,
  GpCallInitiator,
  GpVideoCall,
  GpCallSettings,
  GpAvailabilityResult,
} from './gp-video';

// ─── Chain ─────────────────────────────────────────────────────────────────
export type {
  ChainType,
  Chain,
  ChainPricing,
  ChainPricingException,
  ChainPatientRegistry,
  DoctorBranchAssignment,
  ResolvedPrice,
} from './chain';

// ─── Health Assistant ──────────────────────────────────────────────────────
export type {
  AssistantContext,
  AssistantSession,
  AssistantMessage,
  SafetyCheckResult,
  FlagType,
  FlaggedResponse,
  MedicationSummary,
  LabResultSummary,
  VitalTrendSummary,
  PrescriptionSummary,
  EncounterSummary,
  FollowUpSummary,
  ProtocolStatusSummary,
  FamilyHistorySummary,
} from './health-assistant';
