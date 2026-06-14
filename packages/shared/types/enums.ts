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

export type TenantTier = 'platform' | 'basic' | 'premium' | 'clinic';

// ─── Session Enums ───────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'completed' | 'escalated' | 'abandoned';

export type SessionChannel =
  | 'app'
  | 'website_widget'
  | 'hospital_kiosk'
  | 'api'
  | 'phone_call';

export type MessageRole = 'ai' | 'patient';

// ─── Phone Call Enums ─────────────────────────────────────────────────────

export type HandoffReason =
  | 'emergency'
  | 'low_confidence'
  | 'stt_failure'
  | 'patient_request'
  | 'dtmf_request';

export type CallEndReason =
  | 'patient_hung_up'
  | 'booking_complete'
  | 'agent_handoff'
  | 'emergency'
  | 'timeout';

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

// ─── Reproductive Health Enums ──────────────────────────────────────────────

export type PregnancyStatus =
  | 'not_pregnant'
  | 'pregnant'
  | 'breastfeeding'
  | 'trying_to_conceive'
  | 'unknown';

export type MenopauseStatus =
  | 'pre_menopause'
  | 'peri_menopause'
  | 'post_menopause'
  | 'not_applicable';

export type MenstrualRegularity =
  | 'regular'
  | 'irregular'
  | 'absent'
  | 'not_applicable';

// ─── Family History Enums ───────────────────────────────────────────────────

export type FamilyRelation =
  | 'father'
  | 'mother'
  | 'sibling'
  | 'paternal_grandparent'
  | 'maternal_grandparent';

export type AllergyCategory =
  | 'medication'
  | 'food'
  | 'environmental'
  | 'contrast'
  | 'other';

// ─── Clinic Enums ───────────────────────────────────────────────────────────

export type ClinicRole =
  | 'clinic_owner'
  | 'clinic_receptionist'
  | 'clinic_billing'
  | 'clinic_doctor';

export type QueueEntrySource = 'walk_in' | 'online_booking' | 'phone_booking';

export type QueueEntryStatus =
  | 'waiting'
  | 'called'
  | 'completed'
  | 'no_show'
  | 'left'
  | 'skipped';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'insurance'
  | 'bank_transfer'
  | 'partial_insurance';

// ─── Lab & Radiology Enums ─────────────────────────────────────────────────

export type LabRole =
  | 'lab_owner'
  | 'lab_receptionist'
  | 'lab_technician'
  | 'lab_billing';

export type LabOrderStatus =
  | 'ordered'
  | 'routed'
  | 'received'
  | 'sample_collected'
  | 'processing'
  | 'results_ready'
  | 'delivered'
  | 'cancelled';

export type LabAppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'sample_taken'
  | 'completed'
  | 'no_show'
  | 'cancelled';

// ─── Pharmacy Enums ─────────────────────────────────────────────────────────

export type PharmacyRole =
  | 'pharmacy_owner'
  | 'pharmacy_staff'
  | 'pharmacy_billing';

// ─── Longitudinal / Vitals Enums ────────────────────────────────────────────

export type VitalType =
  | 'weight_kg'
  | 'height_cm'
  | 'bmi'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'blood_glucose_fasting'
  | 'blood_glucose_random'
  | 'heart_rate'
  | 'oxygen_saturation'
  | 'temperature'
  | 'waist_cm';

export type VitalSource = 'clinic_visit' | 'lab_result' | 'patient_self';

export type FollowUpStatus = 'scheduled' | 'reminded' | 'completed' | 'overdue' | 'cancelled';

// ─── Care Coordination Enums ────────────────────────────────────────────────

export type GPRequestStatus = 'pending' | 'active' | 'declined' | 'ended';
export type GPRequestInitiator = 'patient' | 'doctor';

export type ReferralStatus =
  | 'draft' | 'sent' | 'accepted' | 'declined'
  | 'appointment_booked' | 'consultation_done' | 'outcome_reported' | 'closed';
export type ReferralTier = 'tier_1' | 'tier_2';

export type ConsentScope = 'full_record' | 'recent_only' | 'specific_conditions';

// ─── Insurance Enums ────────────────────────────────────────────────────────

export type InsuranceRole = 'insurance_admin' | 'insurance_reviewer' | 'insurance_finance';

export type PolicyStatus = 'active' | 'suspended' | 'expired' | 'pending_verification' | 'unverified';

export type PreauthStatus =
  | 'submitted' | 'under_review' | 'approved' | 'approved_partial'
  | 'denied' | 'expired' | 'cancelled';

export type ClaimStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved' | 'approved_partial'
  | 'paid' | 'rejected' | 'appealed' | 'closed';

export type ClaimType =
  | 'consultation' | 'lab_test' | 'imaging' | 'medication'
  | 'procedure' | 'hospitalization';

export type PrescriptionRoutingStatus =
  | 'prescribed'
  | 'routed'
  | 'received'
  | 'checking_stock'
  | 'ready'
  | 'partial_ready'
  | 'collected'
  | 'cancelled';
